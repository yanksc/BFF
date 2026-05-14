import { z } from "zod";

export const CompanionGender = z.enum(["masc", "femme", "neutral"]);
export const Tone = z.enum(["gentle", "balanced", "hype"]);
export const Frequency = z.enum(["1-2", "3-4", "5+"]);

export const OnboardingSchema = z.object({
  name: z.string().trim().min(1).max(60),
  companionGender: CompanionGender,
  companionName: z.string().trim().min(1).max(40),
  fitnessGoal: z.string().trim().min(1).max(120),
  workoutFrequency: Frequency,
  tone: Tone,
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const ChatSchema = z.object({
  content: z.string().max(4000).default(""),
  imageUrl: z.string().url().nullable().optional(),
});
