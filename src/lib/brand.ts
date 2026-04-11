export const BRAND = {
  name: "Bricks of India",
  tagline: "More Bricks. Less Nonsense.",
  seoSubtitle: "India's Honest Guide to LEGO — Prices, Reviews & Where to Buy",
  domain: "https://bricksofindia.com",
  youtube: "https://www.youtube.com/@BricksofIndia",
  instagram: "https://www.instagram.com/bricksofindia/",
  toycraCode: "ABHINAV12",
  toycraDiscount: "12%",
  toycraMinOrder: "₹500",
} as const;

export const MASCOTS = {
  blue: {
    welcome: "/mascots/blue-fig-welcome.png",
    pointing: "/mascots/blue-fig-pointing.png",
    phone: "/mascots/blue-fig-phone.png",
    shocked: "/mascots/blue-fig-shocked.png",
    thumbsUp: "/mascots/blue-fig-thumbsup.png",
    thumbsDown: "/mascots/blue-fig-thumbsdown.png",
    confused: "/mascots/blue-fig-confused.png",
    celebrate: "/mascots/blue-fig-celebrate.png",
  },
  red: {
    trophy: "/mascots/red-fig-trophy.png",
    thumbsUp: "/mascots/red-fig-thumbsup.png",
    thumbsDown: "/mascots/red-fig-thumbsdown.png",
    pointing: "/mascots/red-fig-pointing.png",
    reading: "/mascots/red-fig-reading.png",
    judging: "/mascots/red-fig-judging.png",
  },
  both: {
    about: "/mascots/both-figs-about.jpg",
    hero: "/mascots/both-figs-hero.jpg",
    celebrate: "/mascots/both-figs-celebrate.png",
  },
} as const;

export const ASSETS = {
  favicon: "/assets/favicon.png",
  ogImage: "/assets/og-image.jpg",
} as const;

export const THEMES = [
  { name: "Technic", slug: "technic", emoji: "⚙️" },
  { name: "City", slug: "city", emoji: "🏙️" },
  { name: "Star Wars", slug: "star-wars", emoji: "⭐" },
  { name: "Harry Potter", slug: "harry-potter", emoji: "🧙" },
  { name: "Speed Champions", slug: "speed-champions", emoji: "🏎️" },
  { name: "Creator", slug: "creator", emoji: "🏗️" },
  { name: "Icons", slug: "icons", emoji: "🏛️" },
  { name: "Botanical", slug: "botanical", emoji: "🌸" },
  { name: "Minecraft", slug: "minecraft", emoji: "⛏️" },
  { name: "Friends", slug: "friends", emoji: "💜" },
] as const;

export const PRICE_RANGES = [
  { label: "Under ₹1,000", min: 0, max: 1000 },
  { label: "₹1,000–₹5,000", min: 1000, max: 5000 },
  { label: "₹5,000–₹15,000", min: 5000, max: 15000 },
  { label: "₹15,000+", min: 15000, max: Infinity },
] as const;
