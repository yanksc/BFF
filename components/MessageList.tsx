"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type UIMessage } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function within(a: string, b: string, ms: number) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < ms;
}
function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function MessageList({
  messages,
  typing,
}: {
  messages: UIMessage[];
  typing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottom.current = dist < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, typing]);

  return (
    <div
      ref={ref}
      className="scroll-quiet flex-1 overflow-y-auto overscroll-contain pb-3"
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="mx-auto flex max-w-md flex-col py-3">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const groupedWithPrev =
            !!prev &&
            prev.role === m.role &&
            within(prev.createdAt, m.createdAt, 60_000);
          const groupedWithNext =
            !!next &&
            next.role === m.role &&
            within(next.createdAt, m.createdAt, 60_000);

          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 text-center text-[11px] uppercase tracking-wider text-muted">
                  {formatDay(m.createdAt)}
                </div>
              )}
              <MessageBubble
                message={m}
                groupedWithPrev={groupedWithPrev}
                groupedWithNext={groupedWithNext}
              />
            </div>
          );
        })}
        {typing && (
          <div className="mt-2 px-3">
            <TypingIndicator />
          </div>
        )}
      </div>
    </div>
  );
}
