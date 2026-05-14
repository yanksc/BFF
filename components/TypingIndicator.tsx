export function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-bubble bg-bubbleThem px-4 py-3">
      <span className="block h-1.5 w-1.5 animate-dot rounded-full bg-muted [animation-delay:-0.32s]" />
      <span className="block h-1.5 w-1.5 animate-dot rounded-full bg-muted [animation-delay:-0.16s]" />
      <span className="block h-1.5 w-1.5 animate-dot rounded-full bg-muted" />
    </div>
  );
}
