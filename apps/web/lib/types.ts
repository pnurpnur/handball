export interface SeasonData {
  id: number;
  name: string;
}

export interface TeamData {
  id: number;
  name: string;
}

export interface EmreStatsData {
  goals: number;
  sevenMeter: number;
  yellowCards: number;
  twoMinutes: number;
  redCards: number;
}

export interface MatchData {
  id: string;
  teamId: number;
  teamName: string;
  seasonId: number | null;
  tournament: string;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
  venue: string | null;
  emreInSquad: boolean;
  emreStats: EmreStatsData | null;
}

export interface TeamStats {
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  avgGoalDiff: number;
}

export interface StatsSummary {
  withEmre: TeamStats;
  withoutEmre: TeamStats;
  overall: TeamStats;
}

export interface EmreOverallStats {
  matchesPlayed: number;
  totalGoals: number;
  totalSevenMeter: number;
  totalYellowCards: number;
  totalTwoMinutes: number;
  totalRedCards: number;
  avgGoals: number;
  avgSevenMeter: number;
  avgYellowCards: number;
  avgTwoMinutes: number;
}

export interface StatsResponse {
  teams: TeamData[];
  perTeam: Record<
    number,
    {
      teamName: string;
      withEmre: TeamStats;
      withoutEmre: TeamStats;
      overall: TeamStats;
    }
  >;
  combined: {
    withEmre: TeamStats;
    withoutEmre: TeamStats;
    overall: TeamStats;
  };
  emre: EmreOverallStats;
}
