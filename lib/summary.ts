import { generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import {
  countMessagesSince,
  getMessagesSince,
  getUser,
  setMemorySummary,
  type UserProfile,
  type MessageRow,
} from "./db";

// Roll the summary forward once we've accumulated this many new messages since the last roll.
const ROLL_THRESHOLD = 10;
// Hard cap on how many messages we feed into a single summarization call.
const MAX_MESSAGES_PER_ROLL = 80;

const SUMMARY_SYSTEM = `You are a memory engine. You produce a rolling summary of THE HUMAN USER (not Mira, the AI companion). The summary helps Mira recall context about this specific user across future conversations.

CRITICAL: The summary is ABOUT THE USER, not about Mira. Mira is a fictional AI persona — anything Mira says about herself (her job, her age, her workouts, her PRs, her city) is FICTIONAL and must be IGNORED for the purposes of the summary. Only record what the USER reveals about themselves.

Rules:
- Output ONLY the updated summary text. No preamble. No "Here's the updated summary:". No quotes around it.
- 150–300 words. Compact, factual, useful for future context.
- Preserve every concrete detail the USER revealed about THEMSELVES: their real name, age, job, location/timezone, relationships, schedule, injuries, goals, PRs, food preferences, music, stated values, recurring topics they care about, emotional state, communication style.
- If the prior summary already captured something and nothing changed, keep it. If new messages contradict or update it, prefer the new info.
- Use short labeled sections (Identity, Work, Fitness, Life context, Emotional state, Recent topics, Conversation style). But sections are optional — flowing prose is fine.
- IGNORE Mira's lines except as signal about what the USER said or asked. Never describe Mira herself in the summary.
- Do NOT speculate or invent. If something is unclear, omit it.
- Write in third person about the user ("they"), not second person ("you").`;

function formatMessagesForPrompt(messages: MessageRow[], userName: string): string {
  return messages
    .map((m) => {
      const who = m.role === "user" ? userName : "Mira";
      const body = m.content.trim();
      if (!body) return null;
      return `${who}: ${body}`;
    })
    .filter(Boolean)
    .join("\n");
}

async function callSummarizer(prompt: string): Promise<string | null> {
  const key = process.env.AI_GATEWAY_KEY;
  if (!key) {
    console.error("[summary] AI_GATEWAY_KEY not set");
    return null;
  }
  const gw = createGateway({ apiKey: key });
  try {
    const result = await generateText({
      model: gw("anthropic/claude-haiku-4-5"),
      system: SUMMARY_SYSTEM,
      prompt,
      maxOutputTokens: 600,
    });
    const text = result.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error("[summary] generateText failed:", (err as Error).message);
    return null;
  }
}

/**
 * Roll the user's summary forward if enough new messages have accumulated.
 * Safe to call as fire-and-forget — errors are logged but never thrown.
 * Returns true if the summary was updated, false otherwise.
 */
export async function maybeRollSummary(userId: string): Promise<boolean> {
  try {
    const user: UserProfile | null = await getUser(userId);
    if (!user) return false;

    const since = user.summary_last_message_at;
    const newCount = await countMessagesSince(userId, since);
    if (newCount < ROLL_THRESHOLD) return false;

    const newMessages = await getMessagesSince(userId, since, MAX_MESSAGES_PER_ROLL);
    if (newMessages.length === 0) return false;

    const transcript = formatMessagesForPrompt(newMessages, user.name);
    if (!transcript) return false;

    const priorBlock = user.memory_summary
      ? `PRIOR SUMMARY (update this; preserve what still holds, revise/add as needed):\n${user.memory_summary}`
      : "PRIOR SUMMARY: (none yet — this is the first roll. Build the initial summary from the transcript below.)";

    const prompt = `${priorBlock}\n\nUSER NAME: ${user.name}\n\nNEW CONVERSATION TRANSCRIPT (oldest first):\n${transcript}\n\nReturn the updated rolling summary.`;

    const newSummary = await callSummarizer(prompt);
    if (!newSummary) return false;

    const throughCreatedAt = newMessages[newMessages.length - 1].created_at;
    await setMemorySummary(userId, newSummary, throughCreatedAt);
    return true;
  } catch (err) {
    console.error("[summary] maybeRollSummary failed:", (err as Error).message);
    return false;
  }
}
