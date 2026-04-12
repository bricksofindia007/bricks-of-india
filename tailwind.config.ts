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
        primary:          "#006CB7",   // LEGO blue — links, outlines, nav accents
        "primary-dark":   "#E3000B",   // LEGO red — footer, hero band, dark sections
        "primary-light":  "#FFF9E6",   // light yellow tint — callout / featured sections
        accent:           "#FFED00",   // LEGO yellow — primary CTA buttons
        "accent-hover":   "#F7A800",   // saffron — hover state
        secondary:        "#E3000B",   // LEGO red — badges, alerts, NEW tags
        dark:             "#1A1A1A",   // body text, headings
        "light-grey":     "#F5F5F0",   // warm off-white
        surface:          "#F5F5F0",   // alternating section backgrounds
        border:           "#E5E5E5",
        "border-strong":  "#CCCCCC",
        "accent-blue":    "#006CB7",
        "deal-green":     "#16A34A",   // best price badges
        "warning-orange": "#FF6B00",
        "text-secondary": "#555555",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "sans-serif"],
        body:    ["var(--font-poppins)", "sans-serif"],
        price:   ["var(--font-poppins)", "sans-serif"],
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
