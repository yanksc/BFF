"use client";

import { useCallback, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { MessageList } from "@/components/MessageList";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { UIMessage } from "@/components/MessageBubble";

let tempCounter = 0;
function tempId() {
  tempCounter += 1;
  return `tmp_${Date.now()}_${tempCounter}`;
}

export function ChatClient({
  initialMessages,
  companionName,
  userName,
}: {
  initialMessages: UIMessage[];
  companionName: string;
  userName: string;
}) {
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [uploading, setUploading] = useState(false);
  const [typing, setTyping] = useState(false);
  // Holds the controller for the in-flight /api/chat fetch so a fresh send can abort it.
  const inFlightAbortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ content, imageFile }: { content: string; imageFile?: File | null }) => {
      // Allow concurrent sends: if a reply is already streaming, abort it and start fresh.
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }

      let imageUrl: string | null = null;
      const localPreview = imageFile ? URL.createObjectURL(imageFile) : null;

      const userTmpId = tempId();
      const now = new Date().toISOString();
      // The user's bubble is considered "sent" the instant they hit send. We've already
      // queued the fetch — no pending faded state. The optimistic insert is durable.
      setMessages((prev) => [
        ...prev,
        {
          id: userTmpId,
          role: "user",
          content,
          imageUrl: localPreview,
          createdAt: now,
        },
      ]);
      // Show the typing indicator immediately so the user knows we're working.
      // The server will keep toggling it on/off via SSE `typing` events for finer pacing.
      setTyping(true);

      const ac = new AbortController();
      inFlightAbortRef.current = ac;

      try {
        if (imageFile) {
          setUploading(true);
          const fd = new FormData();
          fd.append("file", imageFile);
          const up = await fetch("/api/upload", { method: "POST", body: fd });
          if (!up.ok) throw new Error("upload failed");
          const { url } = await up.json();
          imageUrl = url;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userTmpId ? { ...m, imageUrl: url } : m
            )
          );
          if (localPreview) URL.revokeObjectURL(localPreview);
          setUploading(false);
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content, ...(imageUrl ? { imageUrl } : {}) }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error("chat failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";
          for (const block of lines) {
            const line = block.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let evt: {
              start?: boolean;
              userMessageId?: string;
              done?: boolean;
              error?: string;
              typing?: boolean;
              generatingImage?: boolean;
              selfie?: boolean;
              imageReplaced?: boolean;
              imageUrl?: string;
              imageMessageId?: string;
              bubble?: boolean;
              id?: string;
              text?: string;
            };
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }

            if (evt.start) {
              // Server confirms the user message is in. Patch the real id onto the optimistic bubble.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === userTmpId ? { ...m, id: evt.userMessageId ?? m.id } : m
                )
              );
            } else if (evt.typing === true || evt.generatingImage) {
              setTyping(true);
            } else if (evt.typing === false) {
              setTyping(false);
            } else if (evt.bubble && typeof evt.text === "string") {
              // Whole bubble arrives at once. Insert as a new assistant message; CSS handles fade-in.
              setTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: evt.id ?? tempId(),
                  role: "assistant" as const,
                  content: evt.text!,
                  createdAt: new Date().toISOString(),
                },
              ]);
            } else if (evt.selfie && evt.imageUrl) {
              setTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: evt.imageMessageId ?? tempId(),
                  role: "assistant" as const,
                  content: "",
                  imageUrl: evt.imageUrl,
                  createdAt: new Date().toISOString(),
                },
              ]);
            } else if (evt.imageReplaced && evt.imageMessageId && evt.imageUrl) {
              // Background Blob upload finished — swap the ephemeral xAI URL for the durable one.
              const id = evt.imageMessageId;
              const url = evt.imageUrl;
              setMessages((prev) =>
                prev.map((m) => (m.id === id ? { ...m, imageUrl: url } : m))
              );
            } else if (evt.done) {
              setTyping(false);
            } else if (evt.error) {
              console.error("[chat] server error:", evt.error);
              setTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: tempId(),
                  role: "assistant" as const,
                  content: `Error: ${evt.error}`,
                  createdAt: new Date().toISOString(),
                },
              ]);
            }
          }
        }
      } catch (err) {
        // AbortError just means a newer send superseded this one — silent.
        if ((err as Error)?.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === userTmpId ? { ...m, pending: false } : m))
          );
        }
      } finally {
        // Only clear typing/inFlight if this fetch was the active one.
        // (A newer send may have replaced inFlightAbortRef already.)
        if (inFlightAbortRef.current === ac) {
          inFlightAbortRef.current = null;
          setTyping(false);
        }
      }
    },
    []
  );

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface/70 px-4 pt-safe backdrop-blur">
        <div className="flex items-center gap-3 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent/80 to-accent/40" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">{companionName}</div>
            <div className="text-[11px] text-muted">with {userName}</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <MessageList messages={messages} typing={typing} />
      <Composer onSend={send} disabled={uploading} />
    </div>
  );
}
