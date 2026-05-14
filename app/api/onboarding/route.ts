import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { OnboardingSchema } from "@/lib/schemas";
import { getSession } from "@/lib/session";
import { insertMessage, insertUser } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const userId = nanoid();

  await insertUser({
    id: userId,
    name: data.name,
    companion_name: data.companionName,
    companion_gender: data.companionGender,
    fitness_goal: data.fitnessGoal,
    workout_frequency: data.workoutFrequency,
    tone: data.tone,
  });

  const greetings: Record<string, string> = {
    gentle: `Hey ${data.name} — I'm ${data.companionName}. Glad you're here. No pressure, no scripts. Just tell me how you're feeling and we'll take it from there.`,
    balanced: `Hi ${data.name}, I'm ${data.companionName}. Whenever you're ready to talk about ${data.fitnessGoal}, I'm here. What's on your mind today?`,
    hype: `${data.name}! It's ${data.companionName}. Buckle up — we're going after ${data.fitnessGoal} together. What did today look like?`,
  };
  const greeting = greetings[data.tone] ?? greetings.balanced;

  await insertMessage({
    id: nanoid(),
    user_id: userId,
    role: "assistant",
    content: greeting,
  });

  const session = await getSession();
  session.userId = userId;
  await session.save();

  return NextResponse.json({ ok: true });
}
