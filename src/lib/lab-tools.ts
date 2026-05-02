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
    href: null,           // LAB-02 not yet merged — change to "/lab/which-set-are-you" when it ships
    status: "coming_soon",
  },
  {
    id: "price-drops",
    name: "Price Drop Board",
    emoji: "📉",
    tagline: "Today's steepest falls. Updated daily. Suspicious by nature.",
    href: null,
    status: "coming_soon",
  },
  {
    id: "retirement-radar",
    name: "Retirement Radar",
    emoji: "⏳",
    tagline: "Sets nearing end-of-life. The fear is the feature.",
    href: null,
    status: "coming_soon",
  },
  {
    id: "heat-map",
    name: "LEGO Heat Map",
    emoji: "🗺️",
    tagline: "Which Indian city searches for LEGO most. We have opinions.",
    href: null,
    status: "coming_soon",
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
