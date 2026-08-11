export type LabTool = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  href: string | null;  // null = coming soon
  status: "live" | "coming_soon";
};

export const LAB_TOOLS: LabTool[] = [
  {
    id: "biryani-index",
    name: "The Biryani Index",
    emoji: "🍛",
    tagline: "How many biryanis is this set? Find out and weep.",
    href: "/lab/biryani-index",
    status: "live",
  },
  {
    id: "which-set-are-you",
    name: "Which Set Are You?",
    emoji: "🎯",
    tagline: "A short quiz that judges your taste and recommends a set.",
    href: "/lab/which-set",
    status: "live",
  },
  {
    id: "price-drops",
    name: "Price Drop Board",
    emoji: "📉",
    tagline: "Today's steepest falls. Updated daily. Suspicious by nature.",
    href: "/lab/price-drops",
    status: "live",
  },
  {
    id: "retirement-radar",
    name: "Retirement Radar",
    emoji: "⏳",
    tagline: "Sets nearing end-of-life. The fear is the feature.",
    href: "/lab/retiring-soon",
    status: "live",
  },
  {
    id: "heat-map",
    name: "LEGO Heat Map",
    emoji: "🗺️",
    tagline: "Which Indian city searches for LEGO most. We have opinions.",
    href: "/lab/heat-map",
    status: "live",
  },
  {
    id: "india-deals",
    name: "India Deals Today",
    emoji: "🏷️",
    tagline: "Every set currently discounted across Indian stores. Updated every 6 hours.",
    href: "/lab/deals",
    status: "live",
  },
  {
    id: "budget-calculator",
    name: "Budget Calculator",
    emoji: "💰",
    tagline: "Enter your budget. Get the best LEGO sets available in Indian stores right now.",
    href: "/lab/budget-calculator",
    status: "live",
  },
  {
    id: "community",
    name: "Community",
    emoji: "🧑‍🤝‍🧑",
    tagline: "Spotlights, builds, and stories from Indian LEGO fans.",
    href: "/community",
    status: "live",
  },
  {
    id: "portfolio",
    name: "The Brick Portfolio",
    emoji: "📊",
    tagline: "Track your collection's value. Show your CA. Or don't.",
    href: null,
    status: "coming_soon",
  },
];
