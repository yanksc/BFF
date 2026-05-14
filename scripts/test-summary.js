// One-off: force a summary roll for a given user id and print result.
// Usage: DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/test-summary.js <userId>

const { neon } = require("@neondatabase/serverless");
const { createGateway } = require("@ai-sdk/gateway");
const { generateText } = require("ai");

const userId = process.argv[2];
if (!userId) {
  console.error("usage: node scripts/test-summary.js <userId>");
  process.exit(1);
}

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const key = process.env.AI_GATEWAY_KEY;
if (!url || !key) {
  console.error("missing POSTGRES_URL or AI_GATEWAY_KEY in env");
  process.exit(1);
}

const sql = neon(url);
const gw = createGateway({ apiKey: key });

const SUMMARY_SYSTEM = `You are a memory engine. You produce a rolling summary of THE HUMAN USER (not Mira, the AI companion).

CRITICAL: The summary is ABOUT THE USER, not about Mira. Mira is a fictional AI persona — anything Mira says about herself is FICTIONAL and must be IGNORED. Only record what the USER reveals about themselves.

Rules:
- Output ONLY the updated summary. No preamble.
- 150–300 words. Compact, factual.
- Preserve concrete details the USER revealed: name, age, job, location, relationships, schedule, goals, preferences, recurring topics, emotional state.
- Use short labeled sections when helpful.
- Write in third person about the user ("they").`;

(async () => {
  const users = await sql`select * from users where id = ${userId}`;
  const user = users[0];
  if (!user) {
    console.error("no such user");
    process.exit(1);
  }
  console.log("user:", user.name, "summary_last_message_at:", user.summary_last_message_at);

  const since = user.summary_last_message_at;
  const messages = since
    ? await sql`select * from messages where user_id = ${userId} and created_at > ${since} order by created_at asc limit 80`
    : await sql`select * from messages where user_id = ${userId} order by created_at asc limit 80`;
  console.log("messages to summarize:", messages.length);
  if (messages.length === 0) return;

  const transcript = messages
    .map((m) => `${m.role === "user" ? user.name : "Mira"}: ${m.content.trim()}`)
    .filter((l) => l.split(": ")[1])
    .join("\n");

  const priorBlock = user.memory_summary
    ? `PRIOR SUMMARY (update this; preserve what holds, revise/add as needed):\n${user.memory_summary}`
    : "PRIOR SUMMARY: (none yet — this is the first roll. Build the initial summary from the transcript below.)";

  const prompt = `${priorBlock}\n\nUSER NAME: ${user.name}\n\nNEW CONVERSATION TRANSCRIPT (oldest first):\n${transcript}\n\nReturn the updated rolling summary.`;

  console.log("calling summarizer...");
  const start = Date.now();
  const result = await generateText({
    model: gw("anthropic/claude-haiku-4-5"),
    system: SUMMARY_SYSTEM,
    prompt,
    maxOutputTokens: 600,
  });
  console.log("done in", Date.now() - start, "ms");
  const summary = result.text.trim();
  console.log("\n=== summary ===\n");
  console.log(summary);

  const through = messages[messages.length - 1].created_at;
  await sql`update users set memory_summary = ${summary}, summary_last_message_at = ${through} where id = ${userId}`;
  console.log("\n=== saved (through", through, ") ===");
})();
