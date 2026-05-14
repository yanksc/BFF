"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { suggestCompanionNames } from "@/lib/persona";

type Step = 0 | 1 | 2 | 3 | 4;

const goalChips = [
  "Lose weight",
  "Build muscle",
  "Stay consistent",
  "Feel better",
];
const frequencyChips: { label: string; value: "1-2" | "3-4" | "5+" }[] = [
  { label: "1–2 / week", value: "1-2" },
  { label: "3–4 / week", value: "3-4" },
  { label: "5+ / week", value: "5+" },
];
const toneChips: { label: string; value: "gentle" | "balanced" | "hype"; sub: string }[] = [
  { label: "Gentle", value: "gentle", sub: "soft & patient" },
  { label: "Balanced", value: "balanced", sub: "warm & steady" },
  { label: "Hype", value: "hype", sub: "high energy" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"masc" | "femme" | "neutral">("neutral");
  const [companionName, setCompanionName] = useState("");
  const [goal, setGoal] = useState("");
  const [frequency, setFrequency] = useState<"1-2" | "3-4" | "5+">("3-4");
  const [tone, setTone] = useState<"gentle" | "balanced" | "hype">("balanced");

  const suggestions = useMemo(() => suggestCompanionNames(gender), [gender]);

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return companionName.trim().length > 0;
    if (step === 2) return goal.trim().length > 0;
    if (step === 3) return Boolean(frequency);
    if (step === 4) return Boolean(tone);
    return false;
  };

  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        companionGender: gender,
        companionName: companionName.trim(),
        fitnessGoal: goal.trim(),
        workoutFrequency: frequency,
        tone,
      }),
    });
    if (res.ok) {
      router.push("/chat");
    } else {
      setSubmitting(false);
    }
  }

  function next() {
    if (step < 4) setStep((s) => (s + 1) as Step);
    else submit();
  }
  function back() {
    if (step > 0) setStep((s) => (s - 1) as Step);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-safe pt-safe">
      <header className="flex items-center justify-between py-4">
        <button
          onClick={back}
          disabled={step === 0}
          className="text-sm text-muted disabled:opacity-30"
        >
          Back
        </button>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i <= step ? "bg-accent" : "bg-border"
              )}
            />
          ))}
        </div>
        <div className="w-10" />
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            className="space-y-6"
          >
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  What should we call you?
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Just a first name is fine.
                </p>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-6 w-full rounded-2xl border border-border bg-surface px-4 py-4 text-lg outline-none transition focus:border-accent"
                />
              </div>
            )}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Pick your companion.
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Choose a voice and a name. You can change this anytime.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {(["masc", "femme", "neutral"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setGender(g);
                        if (!companionName) setCompanionName("");
                      }}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-sm capitalize transition",
                        gender === g
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface"
                      )}
                    >
                      {g === "neutral" ? "Neutral" : g === "masc" ? "Masc" : "Femme"}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestions.map((n) => (
                    <button
                      key={n}
                      onClick={() => setCompanionName(n)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition",
                        companionName === n
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface text-bubbleThemText/70"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  placeholder="…or type a name"
                  className="mt-4 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
                />
              </div>
            )}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  What's your goal?
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Pick one, or write your own.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {goalChips.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGoal(g)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition",
                        goal === g
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface text-bubbleThemText/70"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Or describe it in your own words"
                  className="mt-4 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
                />
              </div>
            )}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  How often do you train?
                </h2>
                <div className="mt-6 flex flex-col gap-2">
                  {frequencyChips.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setFrequency(c.value)}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left text-base transition",
                        frequency === c.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  How do you want to be encouraged?
                </h2>
                <div className="mt-6 flex flex-col gap-2">
                  {toneChips.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left transition",
                        tone === t.value
                          ? "border-accent bg-accent/10"
                          : "border-border bg-surface"
                      )}
                    >
                      <div className={cn("text-base font-medium", tone === t.value && "text-accent")}>
                        {t.label}
                      </div>
                      <div className="text-xs text-muted">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pb-4">
        <button
          onClick={next}
          disabled={!canAdvance() || submitting}
          className={cn(
            "w-full rounded-2xl px-5 py-4 text-base font-medium transition active:scale-[0.98]",
            canAdvance() && !submitting
              ? "bg-accent text-white shadow-lg shadow-accent/20"
              : "bg-surface text-muted"
          )}
        >
          {submitting ? "Setting things up…" : step === 4 ? "Begin" : "Continue"}
        </button>
      </div>
    </main>
  );
}
