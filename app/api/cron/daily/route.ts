import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  getRecentMemories,
  getUser,
  insertMessage,
  listAllUserIds,
} from "@/lib/db";
import { ai } from "@/lib/ai";
import { sendMms } from "@/lib/mms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userIds = await listAllUserIds();
  let processed = 0;

  for (const userId of userIds) {
    const user = await getUser(userId);
    if (!user) continue;
    const memories = await getRecentMemories(userId, 10);

    let text = "";
    const iter = ai.streamReply({
      user,
      history: [],
      memories,
      userMessage: { role: "user", content: "" },
      mode: "daily",
    });
    for await (const part of iter) {
      if (part.type === "text") text += part.text;
      // Ignore bubble_break and selfie_call in daily nudge mode — flatten to one message.
    }

    await insertMessage({
      id: nanoid(),
      user_id: userId,
      role: "assistant",
      content: text,
    });

    // No-op stub today; ready for SMS provider later.
    await sendMms(userId, text).catch(() => {});

    processed++;
  }

  return NextResponse.json({ processed });
}
