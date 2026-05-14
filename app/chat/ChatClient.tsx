"use client";

import { useCallback, useState } from "react";
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
  const [streaming, setStreaming] = useState(false);
  const [typing, setTyping] = useState(false);

  const send = useCallback(
    async ({ content, imageFile }: { content: string; imageFile?: File | null }) => {
      if (streaming) return;

      let imageUrl: string | null = null;
      const localPreview = imageFile ? URL.createObjectURL(imageFile) : null;

      const userTmpId = tempId();
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        {
          id: userTmpId,
          role: "user",
          content,
          imageUrl: localPreview,
          createdAt: now,
          pending: true,
        },
      ]);
      setStreaming(true);
      setTyping(true);

      try {
        if (imageFile) {
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
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content, imageUrl }),
        });
        if (!res.ok || !res.body) throw new Error("chat failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const assistantTmpId = tempId();
        let started = false;

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
              delta?: string;
              done?: boolean;
              messageId?: string;
              error?: string;
            };
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }

            if (evt.start) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === userTmpId
                    ? { ...m, id: evt.userMessageId ?? m.id, pending: false }
                    : m
                )
              );
            } else if (typeof evt.delta === "string") {
              if (!started) {
                started = true;
                setTyping(false);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantTmpId,
                    role: "assistant",
                    content: evt.delta!,
                    createdAt: new Date().toISOString(),
                    streaming: true,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantTmpId
                      ? { ...m, content: m.content + evt.delta! }
                      : m
                  )
                );
              }
            } else if (evt.done) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantTmpId
                    ? { ...m, id: evt.messageId ?? m.id, streaming: false }
                    : m
                )
              );
            } else if (evt.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantTmpId
                    ? { ...m, content: m.content + "\n(connection lost)", streaming: false }
                    : m
                )
              );
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === userTmpId ? { ...m, pending: false } : m))
        );
      } finally {
        setStreaming(false);
        setTyping(false);
      }
    },
    [streaming]
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
      <Composer onSend={send} disabled={streaming} />
    </div>
  );
}
