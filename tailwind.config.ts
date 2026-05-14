import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surfaceAlt: "var(--surface-alt)",
        bubbleMe: "var(--bubble-me)",
        bubbleMeText: "var(--bubble-me-text)",
        bubbleThem: "var(--bubble-them)",
        bubbleThemText: "var(--bubble-them-text)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        border: "var(--border)",
      },
      borderRadius: {
        bubble: "1.25rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      keyframes: {
        bubbleIn: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        dot: {
          "0%, 80%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-2px)" },
        },
      },
      animation: {
        bubbleIn: "bubbleIn 220ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        dot: "dot 1.2s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
