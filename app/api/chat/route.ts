import { nanoid } from "nanoid";
import { ChatSchema } from "@/lib/schemas";
import { requireUserId } from "@/lib/session";
import {
  getMessages,
  getRecentMemories,
  getUser,
  insertMessage,
} from "@/lib/db";
import { ai, type ChatTurn } from "@/lib/ai";
import { extractAndStoreMemories } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseLine(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
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
    return new Response(JSON.stringify({ error: "invalid" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { content, imageUrl } = parsed.data;
  if (!content && !imageUrl) {
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

  // Persist user message first.
  const userMsgId = nanoid();
  await insertMessage({
    id: userMsgId,
    user_id: userId,
    role: "user",
    content,
    image_url: imageUrl ?? null,
  });

  // Fire-and-forget memory extraction.
  if (content) extractAndStoreMemories(userId, content).catch(() => {});

  const history = (await getMessages(userId, { limit: 20 })).map<ChatTurn>((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    imageUrl: m.image_url,
  }));
  const memories = await getRecentMemories(userId, 10);

  const assistantMsgId = nanoid();
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseLine({ start: true, userMessageId: userMsgId })));
        const iter = ai.streamReply({
          user,
          history,
          memories,
          userMessage: { role: "user", content, imageUrl },
        });
        for await (const delta of iter) {
          full += delta;
          controller.enqueue(encoder.encode(sseLine({ delta })));
        }
        await insertMessage({
          id: assistantMsgId,
          user_id: userId,
          role: "assistant",
          content: full,
        });
        controller.enqueue(
          encoder.encode(sseLine({ done: true, messageId: assistantMsgId }))
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(sseLine({ error: (err as Error).message }))
        );
      } finally {
        controller.close();
      }
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
