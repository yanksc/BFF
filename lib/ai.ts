import type { UserProfile } from "./db";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
};

export interface AIProvider {
  streamReply(args: {
    user: UserProfile;
    history: ChatTurn[];
    memories: string[];
    userMessage: ChatTurn;
    mode?: "chat" | "daily";
  }): AsyncIterable<string>;
  generateCompanionImage?(prompt: string): Promise<string | null>;
}

// ---- Mock provider ---------------------------------------------------------

const TEMPLATES: Record<string, string[]> = {
  gentle: [
    "Hey {name} — proud of you for checking in. Even small steps toward {goal} count today.",
    "{name}, breathe. One session at a time. {companion} is right here whenever you need.",
    "However today went, you showed up. That matters more than you think.",
  ],
  balanced: [
    "Love that, {name}. Let's keep the momentum on {goal} — what's the next move today?",
    "Okay {name}, I'm in. Tell me how the session felt and we'll build from there.",
    "Solid. You're stacking days, and that's exactly how {goal} gets real.",
  ],
  hype: [
    "LET'S GO {name}!! {goal} is closer than yesterday, no question.",
    "That's the energy I'm talking about. Tomorrow's session? Already a win.",
    "You're the engine, {name}. {companion} just rides shotgun.",
  ],
};

const IMAGE_REPLIES: Record<string, string[]> = {
  gentle: [
    "Thanks for sharing that with me, {name}. I can see the effort — and I'm here for it.",
    "There's something quiet and strong in this. Proud of you.",
  ],
  balanced: [
    "Looking good, {name}. How'd that session feel compared to last week?",
    "Nice — I can read the work in this. Tell me what you're chasing next.",
  ],
  hype: [
    "OH {name} — this is the look of someone working for {goal}. Keep going!",
    "Frame it. Seriously. This is what showing up looks like.",
  ],
};

const DAILY_NUDGES: Record<string, string[]> = {
  gentle: [
    "Morning {name}. A small intention today is enough. What feels possible?",
    "Just checking in — whatever you do today, do it with kindness toward yourself.",
  ],
  balanced: [
    "Morning {name}. One honest session today gets you closer to {goal}. I'm around.",
    "Hey — quick check-in. What's the one thing you'd be proud of finishing today?",
  ],
  hype: [
    "{name}!! New day, same goal, more reps. Let's get it.",
    "Eyes up. {goal} doesn't build itself. You and me — today.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(template: string, user: UserProfile): string {
  return template
    .replaceAll("{name}", user.name)
    .replaceAll("{companion}", user.companion_name)
    .replaceAll("{goal}", user.fitness_goal);
}

async function* tokenize(text: string): AsyncIterable<string> {
  // Split into small chunks (1-3 chars) with jittered delay to feel like a real stream.
  let i = 0;
  while (i < text.length) {
    const step = 1 + Math.floor(Math.random() * 3);
    const chunk = text.slice(i, i + step);
    i += step;
    yield chunk;
    await new Promise((r) => setTimeout(r, 18 + Math.floor(Math.random() * 30)));
  }
}

export const mockProvider: AIProvider = {
  async *streamReply({ user, userMessage, memories, mode }) {
    const tone = (user.tone as keyof typeof TEMPLATES) || "balanced";
    let bank: string[];
    if (mode === "daily") {
      bank = DAILY_NUDGES[tone] ?? DAILY_NUDGES.balanced;
    } else if (userMessage.imageUrl) {
      bank = IMAGE_REPLIES[tone] ?? IMAGE_REPLIES.balanced;
    } else {
      bank = TEMPLATES[tone] ?? TEMPLATES.balanced;
    }

    let line = interpolate(pick(bank), user);

    // Lightly reference a memory ~30% of the time.
    if (memories.length > 0 && Math.random() < 0.3 && mode !== "daily") {
      line += ` (Still thinking about when you ${memories[memories.length - 1]} — that wasn't nothing.)`;
    }

    yield* tokenize(line);
  },

  async generateCompanionImage() {
    // Stub for future image-generation provider.
    return null;
  },
};

// Single export — swap this line when the real provider is ready.
export const ai: AIProvider = mockProvider;
