import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-between px-6 pb-safe pt-safe">
      <div className="flex w-full flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 h-20 w-20 rounded-full bg-gradient-to-br from-accent/80 to-accent/40 shadow-[0_18px_60px_-12px_var(--accent)]" />
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          A quiet space to stay in motion.
        </h1>
        <p className="max-w-xs text-balance text-base text-muted">
          A private companion that checks in, remembers, and cheers you on —
          gently, on your terms.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 pb-4">
        <Link
          href="/onboarding"
          className="block w-full rounded-2xl bg-accent px-5 py-4 text-center text-base font-medium text-white shadow-lg shadow-accent/20 transition active:scale-[0.98]"
        >
          Get started
        </Link>
        <Link
          href="/chat"
          className="block w-full rounded-2xl bg-surface px-5 py-4 text-center text-sm font-medium text-bubbleThemText/70 transition active:scale-[0.98]"
        >
          I already have a companion
        </Link>
      </div>
    </main>
  );
}
