/**
 * KMB Route Badge Styling
 *
 * Route number coloring rules (in priority order):
 * 1. Premium routes (P...) - white text on #CA856A
 * 2. Airport Night routes (NA...) - #FFFF00 text on black
 * 3. Overnight routes (N...) - white text on black
 * 4. Airport routes (A...) - #FFFF00 text on #263576
 * 5. External/shuttle routes (E... or S...) - white text on #FFA500
 * 6. HK routes (HK...) - #00AEEE text on white
 * 7. Cross harbour routes (1XX, 3XX, 6XX) - white text on red
 * 8. Western harbour crossing (9XX) - white text on #008000
 * 9. Default/normal routes - black text on white
 */

export type RouteBadgeStyle = {
  textColor: string;
  bgColor: string;
};

export function getRouteBadgeStyle(route: string): RouteBadgeStyle {
  const r = route.toUpperCase().trim();

  // Priority 1: Premium routes (P...)
  if (r.startsWith("P")) {
    return { textColor: "#FFFFFF", bgColor: "#CA856A" };
  }

  // Priority 2: Airport Night routes (NA...)
  if (r.startsWith("NA")) {
    return { textColor: "#FFFF00", bgColor: "#000000" };
  }

  // Priority 3: Overnight routes (N...)
  if (r.startsWith("N")) {
    return { textColor: "#FFFFFF", bgColor: "#000000" };
  }

  // Priority 4: Airport routes (A...)
  if (r.startsWith("A")) {
    return { textColor: "#FFFF00", bgColor: "#263576" };
  }

  // Priority 5: External/shuttle routes (E... or S...)
  if (r.startsWith("E") || r.startsWith("S")) {
    return { textColor: "#FFFFFF", bgColor: "#FFA500" };
  }

  // Priority 6: HK routes
  if (r.startsWith("HK")) {
    return { textColor: "#00AEEE", bgColor: "#FFFFFF" };
  }

  // Priority 7-8: Cross harbour / Western harbour
  // Match optional single letter prefix (except P which is Premium) followed by 3XX, 6XX, 9XX
  // Examples: 307, 603, 962, R603, X962
  const numMatch = r.match(/^[A-OQ-Z]?(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    // 1XX, 3XX or 6XX: Cross harbour (red)
    if (
      (num >= 100 && num < 200) ||
      (num >= 300 && num < 400) ||
      (num >= 600 && num < 700)
    ) {
      return { textColor: "#FFFFFF", bgColor: "#DC2626" };
    }
    // 9XX: Western harbour crossing (green)
    if (num >= 900 && num < 1000) {
      return { textColor: "#FFFFFF", bgColor: "#008000" };
    }
  }

  // Default: normal routes - black on white
  return { textColor: "#000000", bgColor: "#FFFFFF" };
}
