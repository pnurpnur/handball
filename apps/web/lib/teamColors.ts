// Team color schemes by ID only
export const TEAM_COLOR_MAP: Record<number, {
  bgClass: string;
  textClass: string;
  statsHeaderClass: string;
  statsColor: "deep-blue" | "blue" | "light-blue" | "white";
  displayName: string;
}> = {
  206064: {
    bgClass: "bg-blue-900",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-900",
    statsColor: "deep-blue",
    displayName: "Tiller 1. div",
  },
  698373: {
    bgClass: "bg-blue-300",
    textClass: "text-blue-900",
    statsHeaderClass: "bg-blue-300",
    statsColor: "light-blue",
    displayName: "Tiller 2. div",
  },
  682520: {
    bgClass: "bg-purple-600",
    textClass: "text-white",
    statsHeaderClass: "bg-purple-600",
    statsColor: "blue",
    displayName: "Tiller G18",
  },
  709787: {
    bgClass: "bg-white",
    textClass: "text-blue-600",
    statsHeaderClass: "bg-white",
    statsColor: "white",
    displayName: "Tiller G20",
  },
};

export function getTeamColors(teamId: number) {
  if (TEAM_COLOR_MAP[teamId]) {
    return TEAM_COLOR_MAP[teamId];
  }

  // Default color for unknown teams
  return {
    bgClass: "bg-sky-50",
    textClass: "text-sky-700",
    statsHeaderClass: "bg-sky-600",
    statsColor: "blue" as const,
    displayName: "Team",
  };
}
