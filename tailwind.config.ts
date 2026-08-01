import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: "#06070C",
          surface: "#12131C",
          surface2: "#181A26",
          border: "#232534",
        },
        brand: {
          purple: "#7C3AED",
          purpleDark: "#5B21B6",
          emerald: "#10B981",
          gold: "#F5B93D",
          red: "#EF4444",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(124, 58, 237, 0.35)",
        goldGlow: "0 0 20px -4px rgba(245, 185, 61, 0.4)",
        card: "0 4px 24px -8px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "pulse-live": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        "pop-in": { "0%": { transform: "scale(0.85)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "trophy-spin": { "0%": { transform: "rotate(-8deg) scale(0.8)" }, "60%": { transform: "rotate(4deg) scale(1.08)" }, "100%": { transform: "rotate(0) scale(1)" } },
      },
      animation: {
        "pulse-live": "pulse-live 1.6s ease-in-out infinite",
        "pop-in": "pop-in 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        shimmer: "shimmer 2s linear infinite",
        "trophy-spin": "trophy-spin 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
};

export default config;
