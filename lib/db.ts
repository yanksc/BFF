import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";

// Lazily initialized so build doesn't require the env var.
let _sql: ReturnType<typeof neon> | null = null;
function getSql() {
  if (!_sql) {
    if (!connectionString) {
      throw new Error(
        "Missing POSTGRES_URL / DATABASE_URL — set it in .env.local or Vercel project env."
      );
    }
    _sql = neon(connectionString);
  }
  return _sql;
}

export type UserProfile = {
  id: string;
  name: string;
  companion_name: string;
  companion_gender: string;
  fitness_goal: string;
  workout_frequency: string;
  tone: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url: string | null;
  created_at: string;
};

export type MemoryRow = {
  id: string;
  user_id: string;
  memory: string;
  created_at: string;
};

export async function getUser(id: string): Promise<UserProfile | null> {
  const sql = getSql();
  const rows = (await sql`select * from users where id = ${id} limit 1`) as UserProfile[];
  return rows[0] ?? null;
}

export async function insertUser(u: Omit<UserProfile, "created_at">) {
  const sql = getSql();
  await sql`
    insert into users (id, name, companion_name, companion_gender, fitness_goal, workout_frequency, tone)
    values (${u.id}, ${u.name}, ${u.companion_name}, ${u.companion_gender}, ${u.fitness_goal}, ${u.workout_frequency}, ${u.tone})
  `;
}

export async function insertMessage(m: {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url?: string | null;
}) {
  const sql = getSql();
  await sql`
    insert into messages (id, user_id, role, content, image_url)
    values (${m.id}, ${m.user_id}, ${m.role}, ${m.content}, ${m.image_url ?? null})
  `;
}

export async function getMessages(
  userId: string,
  opts: { limit?: number; before?: string } = {}
): Promise<MessageRow[]> {
  const sql = getSql();
  const limit = Math.min(opts.limit ?? 100, 200);
  if (opts.before) {
    const rows = (await sql`
      select * from messages
      where user_id = ${userId} and created_at < ${opts.before}
      order by created_at desc
      limit ${limit}
    `) as MessageRow[];
    return rows.reverse();
  }
  const rows = (await sql`
    select * from messages
    where user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `) as MessageRow[];
  return rows.reverse();
}

export async function getRecentMemories(userId: string, n = 10): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from memories where user_id = ${userId}
    order by created_at desc limit ${n}
  `) as MemoryRow[];
  return rows.map((r) => r.memory).reverse();
}

export async function insertMemory(id: string, userId: string, memory: string) {
  const sql = getSql();
  await sql`insert into memories (id, user_id, memory) values (${id}, ${userId}, ${memory})`;
}

export async function listAllUserIds(): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`select id from users`) as { id: string }[];
  return rows.map((r) => r.id);
}
