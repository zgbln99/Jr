import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vf: {
          red: "#e60000",
          "red-dark": "#ac1811",
          charcoal: "#25282b",
          body: "#7e7e7e",
          form: "#333333",
          disabled: "#bebebe",
          neutral: "#f2f2f2",
          link: "#3860be",
          "white-10": "rgba(255,255,255,0.1)",
          "white-25": "rgba(255,255,255,0.25)",
          "white-70": "rgba(255,255,255,0.7)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-xl": ["9rem", { lineHeight: "0.79", letterSpacing: "-0.03em" }],
        "display-lg": ["7.875rem", { lineHeight: "0.9", letterSpacing: "-0.025em" }],
        "display-md": ["5.625rem", { lineHeight: "0.93", letterSpacing: "-0.02em" }],
        "display-sm": ["4.375rem", { lineHeight: "1.0", letterSpacing: "-0.015em" }],
        h1: ["3rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        h2: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.005em" }],
        h3: ["2rem", { lineHeight: "1.2" }],
        h4: ["1.5rem", { lineHeight: "1.3" }],
        h5: ["1.25rem", { lineHeight: "1.35" }],
      },
      borderRadius: {
        pill: "9999px",
        card: "6px",
        corner: "0 6px 0 0",
        rect: "2px",
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter: "-0.02em",
      },
    },
  },
  plugins: [],
};

export default config;
