const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

const url =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!url) {
  console.error("No Postgres URL found. Set POSTGRES_URL in .env.local");
  process.exit(1);
}

const sql = neon(url);
const schema = fs.readFileSync(
  path.join(__dirname, "../db/schema.sql"),
  "utf8"
);
const stmts = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

(async () => {
  for (const stmt of stmts) {
    await sql([stmt]);
  }
  console.log("✓ Schema applied successfully");
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
