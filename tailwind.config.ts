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
        primary: "#1A56DB",
        "primary-dark": "#1e3a8a",
        "primary-light": "#EFF6FF",
        accent: "#F59E0B",
        "accent-hover": "#D97706",
        secondary: "#CC0000",
        dark: "#111827",
        "light-grey": "#F9FAFB",
        surface: "#F9FAFB",
        border: "#E5E7EB",
        "accent-blue": "#1A56DB",
        "deal-green": "#00A650",
        "warning-orange": "#FF6B00",
        "text-secondary": "#6B7280",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-poppins)", "sans-serif"],
        price: ["var(--font-poppins)", "sans-serif"],
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
