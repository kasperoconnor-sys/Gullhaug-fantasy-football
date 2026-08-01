import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: "#F7F8FA",
          surface: "#FFFFFF",
          surface2: "#F1F2F5",
          border: "#E4E6EB",
        },
        brand: {
          purple: "#6D28D9",
          purpleDark: "#4C1D95",
          emerald: "#059669",
          gold: "#B45309",
          red: "#DC2626",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.08)",
      },
      keyframes: {
        "pulse-live": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        "pop-in": { "0%": { transform: "scale(0.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "pulse-live": "pulse-live 1.6s ease-in-out infinite",
        "pop-in": "pop-in 0.2s ease-out",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
