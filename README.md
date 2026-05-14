# Companion — Mobile-first Chat MVP

A private, mobile-first chat experience with a supportive AI fitness companion.
Built with Next.js (App Router), TypeScript, Tailwind, Vercel Postgres + Blob.

The AI layer is mocked behind a single seam (`lib/ai.ts`) — swap in your real
provider when ready without touching any UI code.

## Features

- Landing → 5-step onboarding → chat
- Anonymous signed-cookie session (no login screen)
- iMessage-style bubbles, smooth scroll, typing indicator, streaming token-by-token
- Image upload (camera or library) → Vercel Blob → AI replies referencing the image
- Persistent chat history (Vercel Postgres)
- Lightweight memory extraction (keyword-based; pluggable later)
- Proactive daily encouragement via Vercel Cron
- Dark / light theme with `prefers-color-scheme` + manual toggle

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure env
cp .env.example .env.local
# Fill in POSTGRES_URL, POSTGRES_URL_NON_POOLING, BLOB_READ_WRITE_TOKEN,
# SESSION_PASSWORD (32+ random chars), CRON_SECRET.
#
# Easiest path: `vercel link` then `vercel env pull .env.local`
# after creating a Postgres store and Blob store in the Vercel dashboard.

# 3. Initialize the DB
npm run db:init

# 4. Run
npm run dev
# → http://localhost:9427
```

Generate a `SESSION_PASSWORD`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Storage schema

See [`db/schema.sql`](db/schema.sql) — three tables: `users`, `messages`, `memories`.
Run it against your Postgres instance once:

```bash
psql "$POSTGRES_URL" -f db/schema.sql
```

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. From the project dashboard, create:
   - a **Postgres** store → automatically injects `POSTGRES_URL*` env vars.
   - a **Blob** store → automatically injects `BLOB_READ_WRITE_TOKEN`.
4. Add `SESSION_PASSWORD` and `CRON_SECRET` env vars manually.
5. Run the schema once against the production DB (you can use the Vercel
   Postgres web console, or `psql` from your machine with the production URL).
6. Deploy. The daily cron from [`vercel.json`](vercel.json) registers automatically.

## Swapping the AI provider

Edit `lib/ai.ts`. Implement the `AIProvider` interface and replace the
`export const ai = mockProvider` line with your real implementation. No UI,
API, or schema changes required.

```ts
export const ai: AIProvider = myRealProvider;
```

The streaming wire format (`/api/chat`) is SSE-ish: each chunk is
`data: {"delta":"..."}\n\n`, with a final `data: {"done":true,"messageId":"..."}`.

## Project layout

```
app/
  page.tsx              # Landing
  onboarding/           # 5-step flow
  chat/                 # Server shell + ChatClient
  api/
    onboarding/         # POST → create user + session cookie
    chat/               # POST → streamed assistant reply
    messages/           # GET  → history
    upload/             # POST → Vercel Blob upload
    cron/daily/         # GET  → proactive daily encouragement
components/             # MessageBubble, MessageList, Composer, TypingIndicator, ThemeToggle
lib/
  ai.ts                 # AI seam — swap me later
  db.ts                 # Postgres helpers
  session.ts            # iron-session config
  persona.ts            # System prompt builder
  memory.ts             # Naive memory extractor
  schemas.ts            # zod validation
  mms.ts                # MMS/SMS stub
db/schema.sql
vercel.json             # cron config
```

## Notes & known simplifications

- The daily cron uses a single UTC time (13:00). Per-user local timezones are
  out of scope for the MVP.
- Memory extraction is regex-based. Swap in embeddings + vector search when
  scale demands.
- `generateCompanionImage` is a stub returning `null`. Wire an image-gen
  provider into `lib/ai.ts` when needed.
- `lib/mms.ts` is a no-op logger — wire to Twilio or similar later.
