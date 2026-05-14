import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getMessages } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "100");

  const rows = await getMessages(userId, { before, limit });
  return NextResponse.json({ messages: rows });
}
