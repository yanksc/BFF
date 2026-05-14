import { nanoid } from "nanoid";
import { insertMemory } from "./db";

// Tiny keyword-based memory extractor. Replace with embeddings later.
const PATTERNS: { re: RegExp; tag: string }[] = [
  { re: /\b(ran|jogged|run)\s+(\d+(?:\.\d+)?)\s*(k|km|mi|miles)\b/i, tag: "ran" },
  { re: /\b(walked)\s+(\d+(?:\.\d+)?)\s*(k|km|mi|miles|steps)\b/i, tag: "walked" },
  { re: /\b(bench|squat|deadlift|press|curl)\s+(\d+)\s*(lb|lbs|kg)\b/i, tag: "lift" },
  { re: /\b(skipped|missed)\s+(leg day|cardio|gym|workout)\b/i, tag: "skipped" },
  { re: /\b(crushed|nailed|smashed)\s+(\w+\s?\w*)\b/i, tag: "win" },
  { re: /\bweigh(?:ed)?\s+(\d+(?:\.\d+)?)\s*(lb|lbs|kg)\b/i, tag: "weight" },
  { re: /\b(sore|tired|exhausted|injured|hurt)\b/i, tag: "state" },
  { re: /\bgoal\s+is\s+(.+?)(?:\.|$)/i, tag: "goal" },
];

export async function extractAndStoreMemories(userId: string, text: string) {
  for (const { re } of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const snippet = m[0].trim().slice(0, 200);
      try {
        await insertMemory(nanoid(), userId, snippet);
      } catch {
        // best-effort, ignore
      }
    }
  }
}
