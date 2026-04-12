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
        primary:          "#006CB7",   // LEGO blue — links, secondary buttons
        "primary-dark":   "#0F2D6B",   // dark navy — footer
        "primary-light":  "#F8F9FA",   // light grey — alternating sections
        accent:           "#F7A800",   // saffron — primary CTA buttons
        "accent-hover":   "#E09500",   // darker saffron — hover
        secondary:        "#E3000B",   // red — badges, alerts, NEW tags
        dark:             "#1A1A1A",   // headings
        "light-grey":     "#F8F9FA",
        surface:          "#F8F9FA",   // alternating section bg
        border:           "#E5E5E5",
        "border-strong":  "#CCCCCC",
        "accent-blue":    "#006CB7",
        "deal-green":     "#16A34A",
        "warning-orange": "#FF6B00",
        "text-secondary": "#666666",
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
