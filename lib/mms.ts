// Placeholder for future MMS / SMS integration.
// Wire a provider (Twilio, etc.) here later; signature stays the same.
export async function sendMms(
  userId: string,
  content: string,
  imageUrl?: string | null
): Promise<{ ok: boolean }> {
  console.log("[mms stub]", { userId, content, imageUrl });
  return { ok: true };
}
