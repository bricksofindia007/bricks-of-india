export const BRAND = {
  name: "Bricks of India",
  tagline: "Every Brick Tells a Story",
  taglineSecondary: "Where Everything Is Awesome, Except Financial Advice",
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

// image: local static theme-card asset (webp) -- migrated off Rebrickable
// 2026-07-06. Path is deterministic (/theme-cards/<slug>.webp), matching
// getThemeCardUrl() in src/lib/themeCard.ts, but inlined directly here
// rather than calling that helper -- themeCard.ts imports THEMES from this
// file, so calling back into it here would be a circular import.
export const THEMES = [
  { name: "Technic",         slug: "technic",         emoji: "⚙️",  image: "/theme-cards/technic.webp",         accentColor: "#CC0000" },
  { name: "City",            slug: "city",            emoji: "🏙️", image: "/theme-cards/city.webp",            accentColor: "#1A56DB" },
  { name: "Star Wars",       slug: "star-wars",       emoji: "⭐",  image: "/theme-cards/star-wars.webp",       accentColor: "#854D0E" },
  { name: "Harry Potter",    slug: "harry-potter",    emoji: "🧙",  image: "/theme-cards/harry-potter.webp",    accentColor: "#7C3AED" },
  { name: "Speed Champions", slug: "speed-champions", emoji: "🏎️", image: "/theme-cards/speed-champions.webp", accentColor: "#EA580C" },
  { name: "Creator",         slug: "creator",         emoji: "🏗️", image: "/theme-cards/creator.webp",         accentColor: "#0D9488" },
  { name: "Icons",           slug: "icons",           emoji: "🏛️", image: "/theme-cards/icons.webp",           accentColor: "#F59E0B" },
  { name: "Botanical",       slug: "botanical",       emoji: "🌸",  image: "/theme-cards/botanical.webp",       accentColor: "#16A34A" },
  { name: "Minecraft",       slug: "minecraft",       emoji: "⛏️", image: "/theme-cards/minecraft.webp",       accentColor: "#65A30D" },
  { name: "Friends",         slug: "friends",         emoji: "💜",  image: "/theme-cards/friends.webp",         accentColor: "#EC4899" },
  { name: "Ninjago",         slug: "ninjago",         emoji: "🥷",  image: "/theme-cards/ninjago.webp",         accentColor: "#DC2626" },
  { name: "Marvel",          slug: "marvel",          emoji: "🕷️", image: "/theme-cards/marvel.webp",          accentColor: "#B91C1C" },
  { name: "DC",              slug: "dc",              emoji: "🦇",  image: "/theme-cards/dc.webp",              accentColor: "#1E3A8A" },
  { name: "Ideas",           slug: "ideas",           emoji: "💡",  image: "/theme-cards/ideas.webp",           accentColor: "#0EA5E9" },
  { name: "Architecture",    slug: "architecture",    emoji: "🗼",  image: "/theme-cards/architecture.webp",    accentColor: "#78716C" },
  { name: "Disney",          slug: "disney",          emoji: "🏰",  image: "/theme-cards/disney.webp",          accentColor: "#9333EA" },
  { name: "BrickHeadz",      slug: "brickheadz",      emoji: "🟨",  image: "/theme-cards/brickheadz.webp",      accentColor: "#F59E0B" },
  { name: "Jurassic World",  slug: "jurassic-world",  emoji: "🦕",  image: "/theme-cards/jurassic-world.webp",  accentColor: "#4D7C0F" },
  { name: "Super Mario",     slug: "super-mario",     emoji: "🍄",  image: "/theme-cards/super-mario.webp",     accentColor: "#DC2626" },
  { name: "Duplo",           slug: "duplo",           emoji: "🧸",  image: "/theme-cards/duplo.webp",           accentColor: "#EA580C" },
  { name: "Art",             slug: "art",             emoji: "🎨",  image: "/theme-cards/art.webp",             accentColor: "#111827" },
  { name: "Dots",            slug: "dots",            emoji: "🔴",  image: "/theme-cards/dots.webp",            accentColor: "#DB2777" },
  { name: "Dreamzzz",        slug: "dreamzzz",        emoji: "🌙",  image: "/theme-cards/dreamzzz.webp",        accentColor: "#4F46E5" },
  { name: "Classic",         slug: "classic",         emoji: "🧱",  image: "/theme-cards/classic.webp",         accentColor: "#F59E0B" },
  { name: "Seasonal",        slug: "seasonal",        emoji: "🎄",  image: "/theme-cards/seasonal.webp",        accentColor: "#DC2626" },
] as const;

export const PRICE_RANGES = [
  { label: "Under ₹1,000", min: 0, max: 1000 },
  { label: "₹1,000–₹5,000", min: 1000, max: 5000 },
  { label: "₹5,000–₹15,000", min: 5000, max: 15000 },
  { label: "₹15,000+", min: 15000, max: Infinity },
] as const;

