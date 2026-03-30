import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.45s ease-out forwards",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "modal-in": "modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "ella-pulse": "ellaPulse 2.8s ease-in-out infinite",
        "ella-glow": "ellaGlow 2.8s ease-in-out infinite",
        "ella-sweep": "ellaSweep 2.2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        modalIn: {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        ellaPulse: {
          "0%, 100%": {
            boxShadow: "0 10px 40px -10px rgba(232, 121, 249, 0.6)",
            transform: "translateY(0)",
          },
          "50%": {
            boxShadow: "0 16px 56px -14px rgba(56, 189, 248, 0.85)",
            transform: "translateY(-1px)",
          },
        },
        ellaGlow: {
          "0%, 100%": {
            background:
              "radial-gradient(120% 120% at 20% 50%, rgba(232,121,249,0.55), rgba(232,121,249,0) 70%)",
          },
          "50%": {
            background:
              "radial-gradient(120% 120% at 80% 50%, rgba(56,189,248,0.55), rgba(56,189,248,0) 72%)",
          },
        },
        ellaSweep: {
          "0%": { transform: "translateX(-160%) skewX(-12deg)", opacity: "0" },
          "15%": { opacity: "0.8" },
          "45%": { transform: "translateX(340%) skewX(-12deg)", opacity: "0" },
          "100%": { transform: "translateX(340%) skewX(-12deg)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
