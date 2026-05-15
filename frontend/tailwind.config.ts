import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "orion-bg": "#050A14",
        "orion-surface": "#0A1628",
        "orion-border": "#0D2040",
        "orion-cyan": "#00D4FF",
        "orion-blue": "#0066FF",
        "orion-text": "#A0C4D8",
        "orion-dim": "#3A5A70",
      },
      fontFamily: {
        mono: ["'Courier New'", "Courier", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
