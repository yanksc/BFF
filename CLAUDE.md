# Project Rules

## API & Model Currency

Always assume any API usage, SDK method, or model identifier in this codebase may be outdated.
Before writing or editing code that touches:
- Vercel AI SDK (`ai`, `@ai-sdk/*`)
- Vercel AI Gateway
- Any model provider (Anthropic, OpenAI, xAI, etc.)

**Look up the current documentation first** to confirm:
- The correct SDK method names and signatures (e.g. `streamText`, `generateImage`, `createGateway`)
- The latest available model IDs (e.g. `claude-opus-4-5` may have a newer version)
- The current auth pattern for the gateway (`AI_GATEWAY_API_KEY`, `createGateway({ apiKey })`, etc.)
- Any deprecated options (e.g. `maxTokens` vs `maxOutputTokens`)

Use the WebFetch or WebSearch tool to check:
- https://sdk.vercel.ai/docs — Vercel AI SDK docs
- https://vercel.com/docs/ai-gateway — Vercel AI Gateway docs
- https://docs.anthropic.com — Anthropic model docs
- Provider release notes / changelogs when picking a model ID

Never assume the model string or SDK call pattern from memory or from existing code in this repo is current.
