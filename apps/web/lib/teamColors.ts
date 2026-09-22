// Team color schemes by ID only
export const TEAM_COLOR_MAP: Record<number, {
  bgClass: string;
  textClass: string;
  statsHeaderClass: string;
  statsColor: "deep-blue" | "blue" | "light-blue" | "white";
}> = {
  206064: {
    bgClass: "bg-blue-900",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-900",
    statsColor: "deep-blue",
  },
  698373: {
    bgClass: "bg-blue-300",
    textClass: "text-blue-900",
    statsHeaderClass: "bg-blue-300",
    statsColor: "light-blue",
  },
  682520: {
    bgClass: "bg-purple-600",
    textClass: "text-white",
    statsHeaderClass: "bg-purple-600",
    statsColor: "blue",
  },
  709787: {
    bgClass: "bg-white",
    textClass: "text-blue-600",
    statsHeaderClass: "bg-white",
    statsColor: "white",
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
  };
}
