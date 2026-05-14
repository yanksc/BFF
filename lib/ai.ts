import { streamText, tool } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { buildSystemPrompt } from "./persona";
import type { UserProfile } from "./db";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
};

export type SelfieCall = {
  type: "selfie_call";
  scene: string;
  outfit: string;
  mood: string;
  full_prompt: string;
};
export type TextPart = { type: "text"; text: string };
export type BubbleBreak = { type: "bubble_break" };
export type StreamPart = TextPart | SelfieCall | BubbleBreak;

export interface AIProvider {
  streamReply(args: {
    user: UserProfile;
    history: ChatTurn[];
    memories: string[];
    userMessage: ChatTurn;
    mode?: "chat" | "daily";
    signal?: AbortSignal;
  }): AsyncIterable<StreamPart>;
}

// ---- Vercel AI Gateway → Anthropic ------------------------------------------

function isAbsoluteUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function buildMessages(history: ChatTurn[], userMessage: ChatTurn, mode?: "chat" | "daily") {
  const msgs = history
    .filter((m) => {
      if (!m.content.trim() && !m.imageUrl) return false;
      return true;
    })
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        m.imageUrl && isAbsoluteUrl(m.imageUrl)
          ? [
              { type: "image" as const, image: new URL(m.imageUrl) },
              { type: "text" as const, text: m.content || "What do you think about this?" },
            ]
          : m.content.trim() || (m.role === "assistant" ? "👍" : "..."),
    }));

  const lastContent =
    userMessage.imageUrl && isAbsoluteUrl(userMessage.imageUrl)
      ? [
          { type: "image" as const, image: new URL(userMessage.imageUrl) },
          { type: "text" as const, text: userMessage.content || "What do you think about this?" },
        ]
      : userMessage.content || (mode === "daily" ? "Send me a warm morning check-in." : "Hey");

  msgs.push({ role: "user", content: lastContent });
  return msgs;
}

// Splits an incoming stream of text deltas on the "---" bubble separator.
// Maintains a small buffer so a "---" split across two deltas is handled correctly.
// Yields TextPart for each segment and BubbleBreak when a separator is found.
async function* splitOnBubbleSeparator(
  source: AsyncIterable<string>
): AsyncIterable<TextPart | BubbleBreak> {
  // Separator pattern: a line containing only "---" (with optional surrounding whitespace).
  // We use a flexible regex so the model can output "\n---\n", "\n ---\n", "\n---", etc.
  const separator = /\n[ \t]*---[ \t]*(?:\n|$)/;
  let buf = "";
  for await (const delta of source) {
    buf += delta;
    // Process all complete separators in the buffer.
    let m: RegExpMatchArray | null;
    while ((m = buf.match(separator))) {
      const idx = m.index!;
      const before = buf.slice(0, idx);
      if (before.length > 0) yield { type: "text", text: before };
      yield { type: "bubble_break" };
      buf = buf.slice(idx + m[0].length);
    }
    // Hold back the tail in case a separator is being assembled across chunks.
    // The longest possible incomplete prefix is "\n---" (4 chars) or "\n ---" — keep last 8 chars buffered.
    if (buf.length > 8) {
      const safe = buf.slice(0, buf.length - 8);
      buf = buf.slice(buf.length - 8);
      if (safe) yield { type: "text", text: safe };
    }
  }
  if (buf.length > 0) yield { type: "text", text: buf };
}

const sendSelfieTool = tool({
  description:
    "Send a selfie to the user. Call this when YOU (Mira) would actually send a selfie in real life. You compose the creative brief — scene, outfit, mood, and a full image-generation prompt. Whether to call this is entirely your judgement based on the persona and conversation. The image gets delivered to the user automatically after you call this.\n\nCRITICAL FOR VARIETY: each selfie should look visibly different from any previous one. Vary the pose (close-up vs full body, mirror selfie vs arm-extended, looking at camera vs candid), the outfit (gym clothes vs casual vs cozy vs going out), the location (gym, kitchen, bedroom, rooftop, street, cafe, couch), the expression (laughing, tired, focused, deadpan, surprised), the lighting (morning sun, harsh overhead gym light, warm lamp, evening shadow), and the framing (low angle, eye level, from above, slightly blurred motion). Match the current time of day and what Mira is plausibly doing. Treat every selfie as a fresh moment, never a re-shoot of a previous one.",
  inputSchema: z.object({
    scene: z.string().describe("Short label for the scene/location, e.g. 'kitchen at night', 'rooftop golden hour', 'post-deadlift gym mirror', 'on the subway'."),
    outfit: z.string().describe("Short label for what she's wearing — vary this every time. e.g. 'black sports bra and bike shorts', 'oversized white tee and boxers', 'half-zip pullover and beanie', 'an old college t-shirt'."),
    mood: z.string().describe("Short label for the vibe/expression — vary this. e.g. 'tired but smug', 'mid-laugh', 'sweaty and red-faced', 'cold and bundled up', 'deadpan staring at the camera'."),
    full_prompt: z
      .string()
      .describe(
        "A complete English image-generation prompt (25–60 words) describing this SPECIFIC moment in vivid detail. Include: the pose and camera angle (e.g. 'mirror selfie at the gym, phone held at chest height'), what she's wearing in concrete terms, her exact expression, the location and any visible background details (e.g. 'racks of dumbbells behind her, fluorescent overhead lighting'), and the lighting/mood. Do NOT describe her face, hair, or build — those are locked separately. Make this moment feel different from any previous selfie you've sent. Be visually specific and concrete."
      ),
  }),
});

export const gatewayProvider: AIProvider = {
  async *streamReply({ user, history, memories, userMessage, mode, signal }) {
    const key = process.env.AI_GATEWAY_KEY;
    if (!key) throw new Error("AI_GATEWAY_KEY is not set");

    const system = buildSystemPrompt(user, memories);
    const messages = buildMessages(history, userMessage, mode);

    const gw = createGateway({ apiKey: key });
    const result = streamText({
      model: gw("anthropic/claude-opus-4-5"),
      system,
      messages: messages as any,
      maxOutputTokens: 500,
      tools: { send_selfie: sendSelfieTool },
      abortSignal: signal,
    });

    // Iterate `fullStream` so we see both text deltas AND tool calls in order.
    // We also need to split text on the bubble separator. We do this by feeding text-deltas
    // through `splitOnBubbleSeparator` while emitting tool calls inline.
    // Since we can't have two consumers of one async iterator, we manually iterate fullStream
    // and forward parts.
    const stream = (await result).fullStream;
    let textBuffer = "";
    const flushText = function* (this: void): Iterable<TextPart | BubbleBreak> {
      // No-op placeholder — we maintain a running text-buffer split iterator below instead.
      return;
    };
    // Implementation: process fullStream chunk by chunk. For text-delta chunks we accumulate
    // into a running iterator. To keep things simple we re-run the splitter ourselves inline.
    const separator = /\n[ \t]*---[ \t]*(?:\n|$)/;
    const emitPending = function* (final: boolean): Generator<TextPart | BubbleBreak> {
      let m: RegExpMatchArray | null;
      while ((m = textBuffer.match(separator))) {
        const idx = m.index!;
        const before = textBuffer.slice(0, idx);
        if (before.length > 0) yield { type: "text", text: before };
        yield { type: "bubble_break" };
        textBuffer = textBuffer.slice(idx + m[0].length);
      }
      if (final) {
        if (textBuffer.length > 0) {
          yield { type: "text", text: textBuffer };
          textBuffer = "";
        }
      } else if (textBuffer.length > 8) {
        const safe = textBuffer.slice(0, textBuffer.length - 8);
        textBuffer = textBuffer.slice(textBuffer.length - 8);
        if (safe) yield { type: "text", text: safe };
      }
    };

    for await (const part of stream) {
      // SDK part types vary — we only care about text-delta and tool-call.
      const type = (part as any).type as string;
      if (type === "text-delta") {
        const text: string = (part as any).text ?? (part as any).delta ?? "";
        if (text) {
          textBuffer += text;
          for (const out of emitPending(false)) yield out;
        }
      } else if (type === "tool-call") {
        // Flush any pending text first so order is preserved (text → tool → text).
        for (const out of emitPending(true)) yield out;
        const toolName = (part as any).toolName;
        if (toolName === "send_selfie") {
          const input = (part as any).input ?? {};
          yield {
            type: "selfie_call",
            scene: String(input.scene ?? ""),
            outfit: String(input.outfit ?? ""),
            mood: String(input.mood ?? ""),
            full_prompt: String(input.full_prompt ?? ""),
          };
        }
      }
      // Ignore other part types (finish, step-finish, error, etc.) — not needed for our protocol.
    }
    // Flush remaining buffered text at the end.
    for (const out of emitPending(true)) yield out;
  },
};

// Active provider — always the gateway (mock provider removed; gateway requires AI_GATEWAY_KEY).
export const ai: AIProvider = gatewayProvider;
