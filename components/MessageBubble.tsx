import Image from "next/image";
import { cn } from "@/lib/utils";

export type UIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  pending?: boolean;
  streaming?: boolean;
};

export function MessageBubble({
  message,
  groupedWithPrev,
  groupedWithNext,
}: {
  message: UIMessage;
  groupedWithPrev: boolean;
  groupedWithNext: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full animate-bubbleIn px-3",
        isUser ? "justify-end" : "justify-start",
        groupedWithPrev ? "mt-0.5" : "mt-2"
      )}
    >
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {message.imageUrl && (
          <div
            className={cn(
              "overflow-hidden rounded-bubble border border-border bg-surfaceAlt shadow-sm",
              isUser ? "self-end" : "self-start"
            )}
          >
            {/* unoptimized to avoid remotePatterns hassle in dev */}
            <Image
              src={message.imageUrl}
              alt=""
              width={320}
              height={320}
              unoptimized
              className="block max-h-[320px] w-auto object-cover"
            />
          </div>
        )}
        {(message.content || message.streaming) && (
          <div
            className={cn(
              "rounded-bubble px-4 py-2.5 text-[15px] leading-snug shadow-[0_1px_0_rgba(0,0,0,0.02)]",
              isUser
                ? "bg-bubbleMe text-bubbleMeText"
                : "bg-bubbleThem text-bubbleThemText",
              message.pending && "opacity-60",
              !groupedWithPrev && (isUser ? "rounded-tr-md" : "rounded-tl-md"),
              !groupedWithNext && (isUser ? "rounded-br-md" : "rounded-bl-md")
            )}
          >
            <span className={cn(message.streaming && "caret")}>{message.content}</span>
          </div>
        )}
      </div>
    </div>
  );
}
