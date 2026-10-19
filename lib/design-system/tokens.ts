/**
 * WeaveCarbon Design System & Animation - Core Tokens & Utilities
 * Derived directly from "Design System & Animation.pdf" (Thẻ 2)
 */

export const DESIGN_TOKENS = {
  colors: {
    // 3.1 Background / Canvas
    background: "#F6F8F2",
    backgroundHsl: "80 30% 96%",

    // 3.2 Foreground / Ink
    foreground: "#111C0D",
    foregroundHsl: "103 37% 8%",

    // 3.3 Card
    card: "#FBFCF8",
    cardHsl: "75 33% 98%",

    // 3.4 Primary (Deep Forest)
    primary: "#145233",
    primaryHsl: "150 61% 20%",
    primaryForeground: "#F6F8F2",

    // 3.6 Secondary
    secondary: "#EDF2E8",
    secondaryHsl: "90 28% 93%",
    secondaryForeground: "#2C441D",

    // 3.8 Muted
    muted: "#DEE9D8",
    mutedHsl: "100 28% 88%",
    mutedForeground: "#52644A",

    // 3.10 Accent
    accent: "#8EB46E",
    accentHsl: "93 32% 57%",
    accentForeground: "#17260D",

    // 3.12 Border / Input
    border: "#D3DFCD",
    borderHsl: "100 22% 84%",

    // Extended
    navy: "#17260D",
    forestDark: "#2C441D",
    forestLight: "#3A7859",
    earthWarm: "#2F4D1F",
    warning: "#DA9B2F",
    destructive: "#C74D4D",
  },

  // 29. CHART COLOR RULES
  chartPalette: {
    primary: "#145233", // Primary deep emerald
    forestLight: "#3A7859", // Forest light
    accent: "#8EB46E", // Accent sage/lime
    earthWarm: "#2F4D1F", // Earth warm
    mutedGreen: "#8BAA78", // Muted green (adjusted for chart clarity)
    warning: "#DA9B2F", // Warning amber (gap / incomplete)
    destructive: "#C74D4D", // Destructive red (error / negative)
  },

  // 31. SHADOW TOKENS
  shadows: {
    sm: "0 2px 8px -5px rgba(23, 38, 13, 0.18)",
    md: "0 16px 40px -24px rgba(23, 38, 13, 0.36), 0 1px 0 rgba(255, 255, 255, 0.82) inset",
    lg: "0 26px 70px -30px rgba(23, 38, 13, 0.42), 0 1px 0 rgba(255, 255, 255, 0.92) inset",
    glow: "0 20px 70px -22px rgba(20, 82, 51, 0.42)",
  },

  // 8. GLOBAL MOTION TOKENS
  motion: {
    fast: "140ms",
    base: "300ms",
    slow: "680ms",
    easeSmooth: "cubic-bezier(0.22, 1, 0.36, 1)",
    easeSpring: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
} as const;

export type StatusPillType =
  | "neutral"
  | "uploaded"
  | "processing"
  | "needs_review"
  | "confirmed"
  | "internal_reviewed"
  | "rejected"
  | "error"
  | "verified"
  | "demo";

/**
 * 30. STATUS PILL / BADGE VISUAL VOCABULARY
 * Consistent radius/padding/font across pages
 */
export function getStatusPillClasses(status: StatusPillType): string {
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide transition-colors";

  switch (status) {
    case "neutral":
    case "uploaded":
      return `${base} bg-[#DEE9D8]/70 text-[#52644A] border border-[#D3DFCD]`;
    case "processing":
      return `${base} bg-emerald-50 text-[#3A7859] border border-emerald-200`;
    case "needs_review":
      return `${base} bg-amber-50 text-[#B47818] border border-amber-200`;
    case "confirmed":
    case "internal_reviewed":
      return `${base} bg-[#EDF2E8] text-[#145233] border border-[#D3DFCD] font-semibold`;
    case "rejected":
    case "error":
      return `${base} bg-red-50 text-[#C74D4D] border border-red-200`;
    case "verified":
      return `${base} bg-[#145233] text-[#F6F8F2] shadow-sm font-semibold`;
    case "demo":
      return `${base} bg-amber-100/80 text-amber-900 border border-amber-300`;
    default:
      return `${base} bg-[#DEE9D8] text-[#52644A]`;
  }
}
