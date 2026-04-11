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
        primary: "#FFD700",
        secondary: "#CC0000",
        dark: "#1A1A1A",
        "light-grey": "#F5F5F5",
        border: "#E8E8E8",
        "accent-blue": "#006CB7",
        "deal-green": "#00A650",
        "warning-orange": "#FF6B00",
      },
      fontFamily: {
        heading: ["Bebas Neue", "sans-serif"],
        body: ["Nunito", "sans-serif"],
        price: ["Space Mono", "monospace"],
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
