import { nanoid } from "nanoid";
import { ChatSchema } from "@/lib/schemas";
import { requireUserId } from "@/lib/session";
import {
  deleteMessages,
  getMessages,
  getRecentMemories,
  getUser,
  insertMessage,
  updateMessageImageUrl,
} from "@/lib/db";
import { ai, type ChatTurn } from "@/lib/ai";
import { extractAndStoreMemories } from "@/lib/memory";
import { generateSelfie } from "@/lib/imageGen";
import { maybeRollSummary } from "@/lib/summary";
import { persistImageToBlob } from "@/lib/blobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseLine(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// Pause between bubbles (after one bubble has appeared, before the next starts typing).
function randomBubblePauseMs() {
  return 800 + Math.floor(Math.random() * 700); // 0.8s – 1.5s
}

// Initial pre-typing delay after the user hits send, before the typing indicator appears.
function preTypingDelayMs() {
  return 400 + Math.floor(Math.random() * 400); // 0.4s – 0.8s
}

// Compute how long the typing indicator should stay on for a given bubble of text.
// Roughly mimics how long it would take to type a message that long. Word count drives this.
// Bounded so very short bubbles still feel deliberate, and long ones don't drag forever.
function typingDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // ~3 words per second baseline + 600ms floor + small random jitter.
  const base = 600 + words * 280;
  const jitter = Math.floor(Math.random() * 400) - 200;
  return Math.min(4000, Math.max(900, base + jitter));
}

// Abortable sleep: resolves either when the time elapses or the signal fires.
function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort);
  });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid", issues: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { content, imageUrl } = parsed.data;
  if (!content.trim() && !imageUrl) {
    return new Response(JSON.stringify({ error: "empty" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const user = await getUser(userId);
  if (!user) {
    return new Response(JSON.stringify({ error: "no user" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Persist the user message immediately so even if this request is aborted, it remains in history.
  const userMsgId = nanoid();
  await insertMessage({
    id: userMsgId,
    user_id: userId,
    role: "user",
    content,
    image_url: imageUrl ?? null,
  });

  if (content) extractAndStoreMemories(userId, content).catch(() => {});

  const trimmed = content.trim();
  const isSlashSelfie = trimmed.toLowerCase().startsWith("/selfie");
  const slashHint = isSlashSelfie ? trimmed.slice("/selfie".length).trim() : "";

  const history = (await getMessages(userId, { limit: 20 })).map<ChatTurn>((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    imageUrl: m.image_url,
  }));
  const memories = await getRecentMemories(userId, 10);

  const encoder = new TextEncoder();
  // Tracks assistant message rows inserted during this turn. On abort we delete them
  // so the next reply doesn't see half-finished history.
  const insertedAssistantIds: string[] = [];
  const signal = req.signal;

  const stream = new ReadableStream({
    async start(controller) {
      let controllerOpen = true;
      const enqueue = (obj: unknown) => {
        if (!controllerOpen) return;
        try {
          controller.enqueue(encoder.encode(sseLine(obj)));
        } catch {
          controllerOpen = false;
        }
      };

      const persistBubble = async (text: string) => {
        const id = nanoid();
        await insertMessage({
          id,
          user_id: userId,
          role: "assistant",
          content: text,
        });
        insertedAssistantIds.push(id);
        return id;
      };

      // If we're aborted, don't persist further bubbles.
      const persistIfStillLive = async (text: string): Promise<string | undefined> => {
        if (signal.aborted) return undefined;
        return persistBubble(text);
      };

      // Background promises we need to await before closing the stream (e.g. Blob uploads).
      const pendingBackground: Promise<void>[] = [];

      // Deliver a selfie: persist a DB row with the (ephemeral) xAI URL immediately so
      // it's in history, emit the SSE event, then kick off a background upload to Vercel
      // Blob. When the upload completes we patch the DB row and push a `imageReplaced`
      // SSE event so the client swaps in the durable URL.
      const deliverSelfie = async (xaiUrl: string) => {
        const imageMessageId = nanoid();
        // Persist immediately so even if the user reloads now, the row exists (xAI URL
        // may still work for ~minutes). We update it with the Blob URL once uploaded.
        await insertMessage({
          id: imageMessageId,
          user_id: userId,
          role: "assistant",
          content: "",
          image_url: xaiUrl,
        });
        insertedAssistantIds.push(imageMessageId);
        enqueue({ selfie: true, imageUrl: xaiUrl, imageMessageId });

        // Background: upload to Blob and patch.
        const bg = (async () => {
          try {
            const durableUrl = await persistImageToBlob(xaiUrl, userId, { signal });
            if (!durableUrl || signal.aborted) return;
            await updateMessageImageUrl(imageMessageId, durableUrl);
            enqueue({ imageReplaced: true, imageMessageId, imageUrl: durableUrl });
          } catch (e) {
            console.warn("[chat] blob persist failed:", (e as Error).message);
          }
        })();
        pendingBackground.push(bg);
      };

      // Helper: pace + emit a single whole-text bubble.
      // - waits the per-bubble "typing time" while showing the indicator
      // - persists the bubble (if not aborted)
      // - emits a single `bubble` event with the full text
      // - turns the typing indicator off
      const emitBubble = async (text: string, isFirstBubble: boolean) => {
        if (!text.trim()) return;
        // Inter-bubble pause: only between bubbles (not before the first one — the
        // pre-typing delay handles that case separately).
        if (!isFirstBubble) {
          await abortableSleep(randomBubblePauseMs(), signal);
          if (signal.aborted) return;
        }
        // Show "typing…" while we wait the computed duration.
        enqueue({ typing: true });
        await abortableSleep(typingDurationMs(text), signal);
        if (signal.aborted) return;
        const persistedId = await persistIfStillLive(text);
        enqueue({ typing: false });
        enqueue({ bubble: true, id: persistedId ?? nanoid(), text });
      };

      try {
        if (signal.aborted) return;
        enqueue({ start: true, userMessageId: userMsgId });

        // Brief delay after send before the typing indicator appears.
        await abortableSleep(preTypingDelayMs(), signal);
        if (signal.aborted) return;

        // ===== Slash command path =====
        if (isSlashSelfie) {
          enqueue({ generatingImage: true });
          const scene = slashHint || "casual moment, whatever you happen to be doing right now";
          const selfieUrl = await generateSelfie(scene, null, { signal });
          if (signal.aborted) return;
          if (selfieUrl) {
            await deliverSelfie(selfieUrl);
          }
          const slashReplyUser: ChatTurn = {
            role: "user",
            content: `[SYSTEM: ${user.name} just used the /selfie command. You (Mira) have already taken and sent a selfie of yourself to them with this scene: "${slashHint || "casual moment"}". They have NOT taken a selfie — YOU did. React naturally with ONE short bubble as if you just sent the photo. Don't say "let me send" or "here you go" — you already did. React to the moment.]`,
          };

          let bubbleText = "";
          const iter = ai.streamReply({
            user,
            history,
            memories,
            userMessage: slashReplyUser,
            signal,
          });
          for await (const part of iter) {
            if (signal.aborted) return;
            if (part.type === "text") bubbleText += part.text;
          }
          await emitBubble(bubbleText, true);
          if (signal.aborted) return;
          enqueue({ done: true });
          return;
        }

        // ===== Normal path =====
        let bubbleBuffer = "";
        let bubbleCount = 0;

        const flushBuffer = async () => {
          if (!bubbleBuffer.trim()) {
            bubbleBuffer = "";
            return;
          }
          await emitBubble(bubbleBuffer, bubbleCount === 0);
          bubbleBuffer = "";
          bubbleCount += 1;
        };

        const iter = ai.streamReply({
          user,
          history,
          memories,
          userMessage: { role: "user", content, imageUrl },
          signal,
        });

        for await (const part of iter) {
          if (signal.aborted) return;
          if (part.type === "text") {
            bubbleBuffer += part.text;
          } else if (part.type === "bubble_break") {
            await flushBuffer();
            if (signal.aborted) return;
          } else if (part.type === "selfie_call") {
            // Send any pending text first so the image lands at a natural break.
            await flushBuffer();
            if (signal.aborted) return;

            // The "generatingImage" event keeps the typing indicator on while we wait
            // for xAI. This is real waiting (5–20s typical), so no artificial pacing here.
            enqueue({ generatingImage: true });
            const selfieUrl = await generateSelfie(
              part.full_prompt || `${part.scene}, ${part.outfit}, ${part.mood}`,
              null,
              { signal }
            );
            if (signal.aborted) return;
            if (selfieUrl) {
              await deliverSelfie(selfieUrl);
              bubbleCount += 1; // image counts as a bubble for pacing purposes
            } else {
              enqueue({ typing: false });
            }
          }
        }

        if (signal.aborted) return;
        await flushBuffer();

        enqueue({ done: true });
      } catch (err) {
        const name = (err as Error)?.name;
        if (name === "AbortError" || signal.aborted) {
          // Client cancelled — clean up partial assistant rows and stay silent.
        } else {
          console.error("[chat] stream error:", err);
          try {
            enqueue({ error: (err as Error).message });
          } catch {}
        }
      } finally {
        // On abort, delete any partial assistant rows so the next turn's history is clean.
        if (signal.aborted && insertedAssistantIds.length > 0) {
          try {
            await deleteMessages(insertedAssistantIds);
          } catch (e) {
            console.warn("[chat] cleanup failed:", (e as Error).message);
          }
        } else if (!signal.aborted) {
          // Wait briefly for in-flight Blob uploads so the `imageReplaced` SSE events have
          // a chance to land in the same stream. Hard-cap so we never hang.
          if (pendingBackground.length > 0) {
            await Promise.race([
              Promise.allSettled(pendingBackground),
              new Promise((r) => setTimeout(r, 5000)),
            ]);
          }
          // Background-roll the long-term summary if enough new messages have accumulated.
          // Fire-and-forget — never block on this.
          maybeRollSummary(userId).catch((e) =>
            console.warn("[chat] summary roll failed:", (e as Error).message)
          );
        }
        controllerOpen = false;
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      // Stream consumer (Response object) was discarded — nothing extra needed; req.signal
      // also fires for fetch-level aborts and drives our cleanup.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
