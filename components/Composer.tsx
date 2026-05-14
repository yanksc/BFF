"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (args: { content: string; imageFile?: File | null }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function pickFile(f: File | null) {
    if (file && preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (disabled) return;
    const content = text.trim();
    if (!content && !file) return;
    setText("");
    const f = file;
    pickFile(null);
    if (taRef.current) taRef.current.style.height = "auto";
    await onSend({ content, imageFile: f });
  }

  return (
    <div className="border-t border-border bg-surface/80 backdrop-blur">
      {preview && (
        <div className="px-3 pt-3">
          <div className="relative inline-block overflow-hidden rounded-2xl border border-border">
            <Image
              src={preview}
              alt=""
              width={120}
              height={120}
              unoptimized
              className="block h-24 w-24 object-cover"
            />
            <button
              onClick={() => pickFile(null)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2 pb-safe">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surfaceAlt text-bubbleThemText/70 transition active:scale-95"
          aria-label="Add image"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 140) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message"
          rows={1}
          className="max-h-[140px] min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-surfaceAlt px-4 py-2.5 text-[15px] leading-snug outline-none transition focus:border-accent"
        />

        <button
          onClick={submit}
          disabled={disabled || (!text.trim() && !file)}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95",
            !text.trim() && !file
              ? "bg-surfaceAlt text-muted"
              : "bg-accent text-white shadow-md shadow-accent/30"
          )}
          aria-label="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l14-7-5 14-2.5-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
