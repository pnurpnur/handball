import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { StatsResponse, TeamStats } from "@/lib/types";

function emptyStats(teamId: number, teamName: string): TeamStats {
  return {
    teamId,
    teamName,
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    avgGoalDiff: 0,
  };
}

function calcResult(
  match: {
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: string;
    awayTeam: string;
    team: { name: string };
  },
  stats: TeamStats
) {
  if (match.homeScore === null || match.awayScore === null) return;

  const teamName = match.team.name;
  const isHome = match.homeTeam
    .toLowerCase()
    .includes(teamName.toLowerCase().split(" ")[0]);

  const teamGoals = isHome ? match.homeScore : match.awayScore;
  const oppGoals = isHome ? match.awayScore : match.homeScore;

  stats.played++;
  stats.goalsFor += teamGoals;
  stats.goalsAgainst += oppGoals;
  stats.goalDiff = stats.goalsFor - stats.goalsAgainst;

  if (teamGoals > oppGoals) stats.won++;
  else if (teamGoals === oppGoals) stats.draw++;
  else stats.lost++;

  stats.avgGoalDiff =
    stats.played > 0 ? Math.round((stats.goalDiff / stats.played) * 10) / 10 : 0;
}

export async function GET() {
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });

  const matches = await prisma.match.findMany({
    where: { isPlayed: true },
    include: {
      team: { select: { id: true, name: true } },
      emreStats: true,
    },
  });

  const emreMatches = matches.filter((m) => m.emreInSquad);
  const nonEmreMatches = matches.filter((m) => !m.emreInSquad);

  // Per-team stats
  const perTeam: StatsResponse["perTeam"] = {};

  for (const team of teams) {
    const teamMatches = matches.filter((m) => m.teamId === team.id);
    const teamWithEmre = teamMatches.filter((m) => m.emreInSquad);
    const teamWithoutEmre = teamMatches.filter((m) => !m.emreInSquad);

    const overall = emptyStats(team.id, team.name);
    const withEmre = emptyStats(team.id, team.name);
    const withoutEmre = emptyStats(team.id, team.name);

    for (const m of teamMatches) calcResult(m, overall);
    for (const m of teamWithEmre) calcResult(m, withEmre);
    for (const m of teamWithoutEmre) calcResult(m, withoutEmre);

    perTeam[team.id] = { teamName: team.name, overall, withEmre, withoutEmre };
  }

  // Combined stats
  const combinedOverall = emptyStats(0, "Alle lag");
  const combinedWithEmre = emptyStats(0, "Med Emre");
  const combinedWithoutEmre = emptyStats(0, "Uten Emre");

  for (const m of matches) calcResult(m, combinedOverall);
  for (const m of emreMatches) calcResult(m, combinedWithEmre);
  for (const m of nonEmreMatches) calcResult(m, combinedWithoutEmre);

  // Emre's personal stats
  const emreStats = await prisma.emreStats.findMany();
  const emrePlayed = emreStats.length;
  const emreTotalGoals = emreStats.reduce((s, e) => s + e.goals, 0);
  const emreTotalSeven = emreStats.reduce((s, e) => s + e.sevenMeter, 0);
  const emreTotalYellow = emreStats.reduce((s, e) => s + e.yellowCards, 0);
  const emreTotalTwo = emreStats.reduce((s, e) => s + e.twoMinutes, 0);
  const emreTotalRed = emreStats.reduce((s, e) => s + e.redCards, 0);

  const avg = (n: number) =>
    emrePlayed > 0 ? Math.round((n / emrePlayed) * 100) / 100 : 0;

  const response: StatsResponse = {
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    perTeam,
    combined: {
      overall: combinedOverall,
      withEmre: combinedWithEmre,
      withoutEmre: combinedWithoutEmre,
    },
    emre: {
      matchesPlayed: emrePlayed,
      totalGoals: emreTotalGoals,
      totalSevenMeter: emreTotalSeven,
      totalYellowCards: emreTotalYellow,
      totalTwoMinutes: emreTotalTwo,
      totalRedCards: emreTotalRed,
      avgGoals: avg(emreTotalGoals),
      avgSevenMeter: avg(emreTotalSeven),
      avgYellowCards: avg(emreTotalYellow),
      avgTwoMinutes: avg(emreTotalTwo),
    },
  };

  return NextResponse.json(response);
}
