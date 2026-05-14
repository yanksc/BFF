import { MIRA_PHYSICAL_DESCRIPTION } from "./persona";

const XAI_GENERATIONS = "https://api.x.ai/v1/images/generations";
const MODEL = "grok-imagine-image-quality";

function buildPrompt(scenePrompt: string): string {
  // The locked face description goes FIRST so it weighs heavily in the model's attention.
  // Then the model-authored scene/outfit/pose/mood, which is allowed full creative freedom.
  return `${MIRA_PHYSICAL_DESCRIPTION}\n\nPHOTO: ${scenePrompt}`;
}

async function callXAI(
  body: object,
  key: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<string | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onExternalAbort = () => ac.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);
  try {
    const res = await fetch(XAI_GENERATIONS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[imageGen] xAI error:", res.status, text.slice(0, 300));
      return null;
    }
    const json = (await res.json()) as { data?: { url?: string }[] };
    return json.data?.[0]?.url ?? null;
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.error("[imageGen] request failed:", (err as Error).message);
    }
    return null;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Generate a fresh selfie from scratch. Identity comes from the locked face description
 * baked into the prompt; everything else (pose, outfit, expression, scene, lighting) is
 * driven by the model-authored `scenePrompt`. We intentionally do NOT use the /edits
 * endpoint with a reference image — that produced near-identical outputs across calls.
 *
 * Note: the `referenceImageUrl` parameter is intentionally ignored (kept in the signature
 * so callers don't need to change). Identity consistency is now provided purely by the
 * detailed physical description in the prompt.
 */
export async function generateSelfie(
  scenePrompt: string,
  _referenceImageUrl?: string | null,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<string | null> {
  const { timeoutMs = 60000, signal } = opts;
  const key = process.env.XAI_API_KEY;
  if (!key) {
    console.error("[imageGen] XAI_API_KEY is not set");
    return null;
  }

  return callXAI(
    {
      model: MODEL,
      prompt: buildPrompt(scenePrompt),
      n: 1,
    },
    key,
    timeoutMs,
    signal
  );
}
