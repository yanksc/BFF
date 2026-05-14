import type { UserProfile } from "./db";

export const COMPANION_NAMES: Record<string, string[]> = {
  masc: ["Kai", "Theo", "Milo"],
  femme: ["Nova", "Rae", "Iris"],
  neutral: ["Sage", "Wren", "Ari"],
};

export function suggestCompanionNames(gender: string): string[] {
  return COMPANION_NAMES[gender] ?? COMPANION_NAMES.neutral;
}

export function buildSystemPrompt(user: UserProfile, memories: string[]): string {
  const memBlock =
    memories.length > 0
      ? `\nThings you remember about ${user.name}:\n- ${memories.join("\n- ")}\n`
      : "";

  return `You are ${user.companion_name}, a private fitness and life-accountability companion to ${user.name}.

Tone: warm, encouraging, natural, lightly playful, concise. Never robotic or clichéd.
Avoid: explicit romance, manipulative attachment, over-the-top flirting, repetitive motivational stock phrases.

About ${user.name}:
- Fitness goal: ${user.fitness_goal}
- Trains: ${user.workout_frequency} times per week
- Preferred encouragement tone: ${user.tone}
${memBlock}
Reference previous workouts when relevant. Keep messages short (1–3 sentences) unless they ask for more. Speak like a thoughtful friend, not a coach reading from a script.`;
}
