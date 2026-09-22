// Team color schemes by ID
export const TEAM_COLOR_MAP_BY_ID: Record<number, {
  name: string;
  bgClass: string;
  textClass: string;
  statsHeaderClass: string;
  statsColor: "deep-blue" | "blue" | "light-blue" | "white";
}> = {
  771912: {
    name: "Tiller senior menn",
    bgClass: "bg-blue-900",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-900",
    statsColor: "deep-blue",
  },
  682520: {
    name: "Tiller 2 senior",
    bgClass: "bg-blue-600",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-600",
    statsColor: "blue",
  },
  709787: {
    name: "Tiller G18",
    bgClass: "bg-blue-300",
    textClass: "text-blue-900",
    statsHeaderClass: "bg-blue-300",
    statsColor: "light-blue",
  },
  928241: {
    name: "Tiller G20",
    bgClass: "bg-stone-200",
    textClass: "text-stone-700",
    statsHeaderClass: "bg-stone-200",
    statsColor: "white",
  },
};

// Team color schemes by name - for more reliable matching
export const TEAM_COLOR_MAP_BY_NAME: Record<string, {
  bgClass: string;
  textClass: string;
  statsHeaderClass: string;
  statsColor: "deep-blue" | "blue" | "light-blue" | "white";
}> = {
  "Tiller senior menn": {
    bgClass: "bg-blue-900",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-900",
    statsColor: "deep-blue",
  },
  "Tiller 2 senior": {
    bgClass: "bg-blue-600",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-600",
    statsColor: "blue",
  },
  "Tiller 2": {
    bgClass: "bg-blue-600",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-600",
    statsColor: "blue",
  },
  "Tiller IL": {
    bgClass: "bg-blue-900",
    textClass: "text-white",
    statsHeaderClass: "bg-blue-900",
    statsColor: "deep-blue",
  },
  "Tiller G18": {
    bgClass: "bg-blue-300",
    textClass: "text-blue-900",
    statsHeaderClass: "bg-blue-300",
    statsColor: "light-blue",
  },
  "Tiller": {
    bgClass: "bg-blue-300",
    textClass: "text-blue-900",
    statsHeaderClass: "bg-blue-300",
    statsColor: "light-blue",
  },
  "Tiller G20": {
    bgClass: "bg-stone-200",
    textClass: "text-stone-700",
    statsHeaderClass: "bg-stone-200",
    statsColor: "white",
  },
};

export const TEAM_COLOR_MAP = TEAM_COLOR_MAP_BY_ID;

export function getTeamColors(teamId: number, teamName?: string) {
  // Priority 1: Team ID lookup (most reliable)
  if (TEAM_COLOR_MAP[teamId]) {
    return TEAM_COLOR_MAP[teamId];
  }

  // Priority 2: Team name lookup
  if (teamName && TEAM_COLOR_MAP_BY_NAME[teamName]) {
    return TEAM_COLOR_MAP_BY_NAME[teamName];
  }

  // Default color
  return {
    bgClass: "bg-sky-50",
    textClass: "text-sky-700",
    statsHeaderClass: "bg-sky-600",
    statsColor: "blue" as const,
  };
}
