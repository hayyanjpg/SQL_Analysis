/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3f0e7",
        surface: "#faf8f1",
        ink: "#171614",
        muted: "#6f695c",
        rule: "#d7d1c2",
        accent: "#df4a26",
        "accent-soft": "#f7e1d8",
        moss: "#2f5d46",
        "moss-soft": "#e3ece6",
        caution: "#8a5a08",
        "caution-soft": "#f8ecd2",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 #171614",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        progress: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(380%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both",
        progress: "progress 1.5s ease-in-out infinite",
        blink: "blink 1.1s steps(2, start) infinite",
      },
    },
  },
  plugins: [],
};
