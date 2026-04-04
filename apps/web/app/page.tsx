import { prisma } from "@/lib/prisma";
import ClientApp from "./ClientApp";
import type { MatchData, StatsResponse, TeamData } from "@/lib/types";

export const revalidate = 300; // Revalidate every 5 minutes (ISR)

async function getTeams(): Promise<TeamData[]> {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return teams;
}

async function getMatches(): Promise<MatchData[]> {
  const matches = await prisma.match.findMany({
    include: {
      team: { select: { id: true, name: true } },
      emreStats: true,
    },
    orderBy: { date: "asc" },
  });

  return matches.map((m) => ({
    id: m.id,
    teamId: m.teamId,
    teamName: m.team.name,
    tournament: m.tournament,
    date: m.date ? m.date.toISOString() : null,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    isPlayed: m.isPlayed,
    venue: m.venue,
    emreInSquad: m.emreInSquad,
    emreStats: m.emreStats
      ? {
          goals: m.emreStats.goals,
          sevenMeter: m.emreStats.sevenMeter,
          yellowCards: m.emreStats.yellowCards,
          twoMinutes: m.emreStats.twoMinutes,
          redCards: m.emreStats.redCards,
        }
      : null,
  }));
}

function buildStats(
  teams: TeamData[],
  matches: MatchData[]
): StatsResponse {
  type S = { played: number; won: number; draw: number; lost: number; goalsFor: number; goalsAgainst: number };
  const empty = (): S => ({ played: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 });

  const addResult = (s: S, match: MatchData, teamName: string) => {
    if (!match.isPlayed || match.homeScore === null || match.awayScore === null) return;
    const isHome = match.homeTeam.toLowerCase().includes(teamName.toLowerCase().split(" ")[0]);
    const tf = isHome ? match.homeScore : match.awayScore!;
    const ta = isHome ? match.awayScore! : match.homeScore;
    s.played++;
    s.goalsFor += tf;
    s.goalsAgainst += ta;
    if (tf > ta) s.won++;
    else if (tf === ta) s.draw++;
    else s.lost++;
  };

  const toTeamStats = (s: S, teamId: number, teamName: string) => ({
    teamId,
    teamName,
    ...s,
    goalDiff: s.goalsFor - s.goalsAgainst,
    avgGoalDiff:
      s.played > 0
        ? Math.round(((s.goalsFor - s.goalsAgainst) / s.played) * 10) / 10
        : 0,
  });

  const perTeam: StatsResponse["perTeam"] = {};
  for (const team of teams) {
    const tm = matches.filter((m) => m.teamId === team.id);
    const ov = empty(), we = empty(), wo = empty();
    for (const m of tm) { addResult(ov, m, team.name); }
    for (const m of tm.filter((m) => m.emreInSquad)) addResult(we, m, team.name);
    for (const m of tm.filter((m) => !m.emreInSquad)) addResult(wo, m, team.name);
    perTeam[team.id] = {
      teamName: team.name,
      overall: toTeamStats(ov, team.id, team.name),
      withEmre: toTeamStats(we, team.id, "Med Emre"),
      withoutEmre: toTeamStats(wo, team.id, "Uten Emre"),
    };
  }

  const playedMatches = matches.filter((m) => m.isPlayed);
  const cov = empty(), cwe = empty(), cwo = empty();
  for (const m of playedMatches) {
    const team = teams.find((t) => t.id === m.teamId);
    if (!team) continue;
    addResult(cov, m, team.name);
    if (m.emreInSquad) addResult(cwe, m, team.name);
    else addResult(cwo, m, team.name);
  }

  const emreStats = matches
    .filter((m) => m.emreInSquad && m.emreStats)
    .map((m) => m.emreStats!);

  const ep = emreStats.length;
  const avg = (n: number) => ep > 0 ? Math.round((n / ep) * 100) / 100 : 0;
  const sum = (fn: (e: typeof emreStats[0]) => number) =>
    emreStats.reduce((s, e) => s + fn(e), 0);

  return {
    teams,
    perTeam,
    combined: {
      overall: toTeamStats(cov, 0, "Alle lag"),
      withEmre: toTeamStats(cwe, 0, "Med Emre"),
      withoutEmre: toTeamStats(cwo, 0, "Uten Emre"),
    },
    emre: {
      matchesPlayed: ep,
      totalGoals: sum((e) => e.goals),
      totalSevenMeter: sum((e) => e.sevenMeter),
      totalYellowCards: sum((e) => e.yellowCards),
      totalTwoMinutes: sum((e) => e.twoMinutes),
      totalRedCards: sum((e) => e.redCards),
      avgGoals: avg(sum((e) => e.goals)),
      avgSevenMeter: avg(sum((e) => e.sevenMeter)),
      avgYellowCards: avg(sum((e) => e.yellowCards)),
      avgTwoMinutes: avg(sum((e) => e.twoMinutes)),
    },
  };
}

export default async function HomePage() {
  const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
  const stats = buildStats(teams, matches);

  return <ClientApp initialMatches={matches} initialStats={stats} teams={teams} />;
}
