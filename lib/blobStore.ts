import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

/**
 * Download an image from a (possibly ephemeral) URL and re-upload it to Vercel Blob
 * for durable storage. Returns the new durable URL, or null on failure.
 *
 * Used to make xAI-generated selfies survive past their short-lived xAI URLs.
 */
export async function persistImageToBlob(
  sourceUrl: string,
  userId: string,
  opts: { signal?: AbortSignal } = {}
): Promise<string | null> {
  const { signal } = opts;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[blobStore] BLOB_READ_WRITE_TOKEN not set; cannot persist image");
    return null;
  }
  const start = Date.now();
  try {
    const res = await fetch(sourceUrl, { signal });
    if (!res.ok) {
      console.error("[blobStore] failed to fetch source image:", res.status);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const buf = await res.arrayBuffer();
    const fetchedMs = Date.now() - start;
    const key = `selfies/${userId}/${nanoid()}.${ext}`;
    const blob = await put(key, buf, {
      access: "public",
      contentType,
    });
    const totalMs = Date.now() - start;
    console.log(`[blobStore] persisted ${(buf.byteLength/1024).toFixed(0)}KB to Blob (fetch ${fetchedMs}ms, total ${totalMs}ms): ${blob.url}`);
    return blob.url;
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.error("[blobStore] persistImageToBlob failed:", (err as Error).message);
    }
    return null;
  }
}
