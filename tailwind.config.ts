import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:          "#006CB7",
        "primary-dark":   "#0F2D6B",
        "primary-light":  "#F8F9FA",
        accent:           "#F7A800",
        "accent-hover":   "#E09500",
        secondary:        "#E3000B",
        dark:             "#1A1A1A",
        "light-grey":     "#F8F9FA",
        surface:          "#F8F9FA",
        border:           "#E5E5E5",
        "border-strong":  "#CCCCCC",
        "accent-blue":    "#006CB7",
        "deal-green":     "#16A34A",
        "warning-orange": "#FF6B00",
        "text-secondary": "#666666",
        // ── Brand design system ─────────────────────────────────────────────
        "boi-yellow":     "#FFC72C",
        "boi-red":        "#E30613",
        "boi-red-dark":   "#8B0309",
        "boi-sky":        "#7EC4E8",
        "boi-sky-light":  "#A8D8ED",
        "boi-navy":       "#1a2332",
        "boi-saffron":    "#FF9933",
        "boi-green":      "#138808",
      },
      fontFamily: {
        heading: ["var(--font-fredoka)", "var(--font-poppins)", "sans-serif"],
        body:    ["var(--font-inter)",   "var(--font-poppins)", "sans-serif"],
        price:   ["var(--font-inter)",   "var(--font-poppins)", "sans-serif"],
        fredoka: ["var(--font-fredoka)", "sans-serif"],
        inter:   ["var(--font-inter)",   "sans-serif"],
        poppins: ["var(--font-poppins)", "sans-serif"],
      },
      screens: {
        xs: "375px",
      },
      maxWidth: {
        site: "1280px",
      },
    },
  },
  plugins: [],
};
export default config;
