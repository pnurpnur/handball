export interface SeasonData {
  id: number;
  name: string;
}

export interface TeamData {
  id: number;
  name: string;
  matchLengthMinutes?: number | null;
}

export interface EmreStatsData {
  goals: number;
  sevenMeter: number;
  yellowCards: number;
  twoMinutes: number;
  redCards: number;
  minutesPlayed: number | null;
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
  teamMatchLength: number | null;
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
  totalGoals: number;       // goals + sevenMeter combined
  totalYellowCards: number;
  totalTwoMinutes: number;
  totalRedCards: number;
  avgGoals: number;
  avgYellowCards: number;
  avgTwoMinutes: number;
  minutesPlayed: number;         // sum of minutes entered
  minutesPossible: number;       // sum of team match length for matches with minutes entered
  minutesPct: number | null;     // minutesPlayed / minutesPossible * 100
  matchesWithMinutes: number;    // how many matches have minutes entered
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
      emreGoals: number;
      emreAvgGoals: number;
      minutesPlayed: number;
      minutesPossible: number;
      minutesPct: number | null;
      matchesWithMinutes: number;
    }
  >;
  combined: {
    withEmre: TeamStats;
    withoutEmre: TeamStats;
    overall: TeamStats;
    emreGoals: number;
    emreAvgGoals: number;
    minutesPlayed: number;
    minutesPossible: number;
    minutesPct: number | null;
    matchesWithMinutes: number;
  };
  emre: EmreOverallStats;
}
