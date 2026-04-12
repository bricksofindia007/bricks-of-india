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
  { name: "Technic",         slug: "technic",         emoji: "⚙️",  image: "https://cdn.rebrickable.com/media/sets/42171-1/42171-1.jpg",  accentColor: "#CC0000" },
  { name: "City",            slug: "city",            emoji: "🏙️", image: "https://cdn.rebrickable.com/media/sets/60404-1/60404-1.jpg",  accentColor: "#1A56DB" },
  { name: "Star Wars",       slug: "star-wars",       emoji: "⭐",  image: "https://cdn.rebrickable.com/media/sets/75398-1/75398-1.jpg",  accentColor: "#854D0E" },
  { name: "Harry Potter",    slug: "harry-potter",    emoji: "🧙",  image: "https://cdn.rebrickable.com/media/sets/76440-1/76440-1.jpg",  accentColor: "#7C3AED" },
  { name: "Speed Champions", slug: "speed-champions", emoji: "🏎️", image: "https://cdn.rebrickable.com/media/sets/76916-1/76916-1.jpg",  accentColor: "#EA580C" },
  { name: "Creator",         slug: "creator",         emoji: "🏗️", image: "https://cdn.rebrickable.com/media/sets/31150-1/31150-1.jpg",  accentColor: "#0D9488" },
  { name: "Icons",           slug: "icons",           emoji: "🏛️", image: "https://cdn.rebrickable.com/media/sets/10350-1/10350-1.jpg",  accentColor: "#F59E0B" },
  { name: "Botanical",       slug: "botanical",       emoji: "🌸",  image: "https://cdn.rebrickable.com/media/sets/10329-1/10329-1.jpg",  accentColor: "#16A34A" },
  { name: "Minecraft",       slug: "minecraft",       emoji: "⛏️", image: "https://cdn.rebrickable.com/media/sets/21251-1/21251-1.jpg",  accentColor: "#65A30D" },
  { name: "Friends",         slug: "friends",         emoji: "💜",  image: "https://cdn.rebrickable.com/media/sets/42651-1/42651-1.jpg",  accentColor: "#EC4899" },
  { name: "Ninjago",         slug: "ninjago",         emoji: "🥷",  image: "https://cdn.rebrickable.com/media/sets/71799-1/71799-1.jpg",  accentColor: "#DC2626" },
  { name: "Marvel",          slug: "marvel",          emoji: "🕷️", image: "https://cdn.rebrickable.com/media/sets/76269-1/76269-1.jpg",  accentColor: "#B91C1C" },
  { name: "DC",              slug: "dc",              emoji: "🦇",  image: "https://cdn.rebrickable.com/media/sets/76240-1/76240-1.jpg",  accentColor: "#1E3A8A" },
  { name: "Ideas",           slug: "ideas",           emoji: "💡",  image: "https://cdn.rebrickable.com/media/sets/21348-1/21348-1.jpg",  accentColor: "#0EA5E9" },
  { name: "Architecture",    slug: "architecture",    emoji: "🗼",  image: "https://cdn.rebrickable.com/media/sets/21058-1/21058-1.jpg",  accentColor: "#78716C" },
  { name: "Disney",          slug: "disney",          emoji: "🏰",  image: "https://cdn.rebrickable.com/media/sets/43226-1/43226-1.jpg",  accentColor: "#9333EA" },
  { name: "BrickHeadz",      slug: "brickheadz",      emoji: "🟨",  image: "https://cdn.rebrickable.com/media/sets/40630-1/40630-1.jpg",  accentColor: "#F59E0B" },
  { name: "Jurassic World",  slug: "jurassic-world",  emoji: "🦕",  image: "https://cdn.rebrickable.com/media/sets/76961-1/76961-1.jpg",  accentColor: "#4D7C0F" },
  { name: "Super Mario",     slug: "super-mario",     emoji: "🍄",  image: "https://cdn.rebrickable.com/media/sets/71411-1/71411-1.jpg",  accentColor: "#DC2626" },
  { name: "Duplo",           slug: "duplo",           emoji: "🧸",  image: "https://cdn.rebrickable.com/media/sets/10434-1/10434-1.jpg",  accentColor: "#EA580C" },
  { name: "Art",             slug: "art",             emoji: "🎨",  image: "https://cdn.rebrickable.com/media/sets/31203-1/31203-1.jpg",  accentColor: "#111827" },
  { name: "Dots",            slug: "dots",            emoji: "🔴",  image: "https://cdn.rebrickable.com/media/sets/41803-1/41803-1.jpg",  accentColor: "#DB2777" },
  { name: "Dreamzzz",        slug: "dreamzzz",        emoji: "🌙",  image: "https://cdn.rebrickable.com/media/sets/71469-1/71469-1.jpg",  accentColor: "#4F46E5" },
  { name: "Classic",         slug: "classic",         emoji: "🧱",  image: "https://cdn.rebrickable.com/media/sets/11037-1/11037-1.jpg",  accentColor: "#F59E0B" },
  { name: "Seasonal",        slug: "seasonal",        emoji: "🎄",  image: "https://cdn.rebrickable.com/media/sets/10293-1/10293-1.jpg",  accentColor: "#DC2626" },
] as const;

export const PRICE_RANGES = [
  { label: "Under ₹1,000", min: 0, max: 1000 },
  { label: "₹1,000–₹5,000", min: 1000, max: 5000 },
  { label: "₹5,000–₹15,000", min: 5000, max: 15000 },
  { label: "₹15,000+", min: 15000, max: Infinity },
] as const;
