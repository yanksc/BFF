import { redirect } from "next/navigation";
import { getMessages, getUser } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { ChatClient } from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const userId = await requireUserId();
  if (!userId) redirect("/onboarding");
  const user = await getUser(userId);
  if (!user) redirect("/onboarding");

  const rows = await getMessages(userId, { limit: 100 });
  const initial = rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    imageUrl: m.image_url,
    createdAt: m.created_at,
  }));

  return (
    <ChatClient
      initialMessages={initial}
      companionName={user.companion_name}
      userName={user.name}
    />
  );
}
