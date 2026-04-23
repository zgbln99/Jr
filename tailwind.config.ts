import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stripe: {
          purple: "#533afd",
          "purple-hover": "#4434d4",
          "purple-deep": "#2e2b8c",
          "purple-light": "#b9b9f9",
          "purple-mid": "#665efd",
          "purple-soft": "#d6d9fc",
          navy: "#061b31",
          "brand-dark": "#1c1e54",
          "dark-navy": "#0d253d",
          ruby: "#ea2261",
          magenta: "#f96bee",
          "magenta-light": "#ffd7ef",
          label: "#273951",
          body: "#64748d",
          border: "#e5edf5",
          success: "#15be53",
          "success-text": "#108c3d",
          lemon: "#9b6829",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "sohne-var",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SourceCodePro", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-hero": ["3.5rem", { lineHeight: "1.03", letterSpacing: "-1.4px" }],
        "display-lg": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.96px" }],
        "section": ["2rem", { lineHeight: "1.10", letterSpacing: "-0.64px" }],
        "sub-lg": ["1.625rem", { lineHeight: "1.12", letterSpacing: "-0.26px" }],
        "sub": ["1.375rem", { lineHeight: "1.10", letterSpacing: "-0.22px" }],
      },
      boxShadow: {
        "stripe-ambient":
          "rgba(23,23,23,0.08) 0px 15px 35px 0px",
        "stripe-soft":
          "rgba(23,23,23,0.06) 0px 3px 6px 0px",
        "stripe-elevated":
          "rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px",
        "stripe-deep":
          "rgba(3,3,39,0.25) 0px 14px 21px -14px, rgba(0,0,0,0.1) 0px 8px 17px -8px",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(ellipse at top, rgba(83,58,253,0.18), transparent 60%)",
        "ruby-magenta":
          "linear-gradient(135deg, #ea2261 0%, #f96bee 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
