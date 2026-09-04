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

type MatchWithTeamAndEmre = Awaited<ReturnType<typeof prisma.match.findMany<{
  where: { isPlayed: true };
  include: { team: { select: { id: true; name: true; matchLengthMinutes: true } }; emreStats: true };
}>>>[number];

function minutesStats(matches: MatchWithTeamAndEmre[]) {
  const withMinutes = matches.filter(
    (m) => m.emreInSquad && m.emreStats?.minutesPlayed != null && m.team.matchLengthMinutes != null
  );
  const minutesPlayed = withMinutes.reduce((s, m) => s + m.emreStats!.minutesPlayed!, 0);
  const minutesPossible = withMinutes.reduce((s, m) => s + m.team.matchLengthMinutes!, 0);
  return {
    minutesPlayed,
    minutesPossible,
    minutesPct: minutesPossible > 0 ? Math.round((minutesPlayed / minutesPossible) * 100) : null,
    matchesWithMinutes: withMinutes.length,
  };
}

export async function GET() {
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });

  const matches = await prisma.match.findMany({
    where: { isPlayed: true },
    include: {
      team: { select: { id: true, name: true, matchLengthMinutes: true } },
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

    const teamEmreMatchStats = teamWithEmre.filter((m) => m.emreStats).map((m) => m.emreStats!);
    const teamEmreGoals = teamEmreMatchStats.reduce((s, e) => s + e.goals + e.sevenMeter, 0);
    perTeam[team.id] = {
      teamName: team.name,
      overall,
      withEmre,
      withoutEmre,
      emreGoals: teamEmreGoals,
      emreAvgGoals: teamEmreMatchStats.length > 0 ? Math.round((teamEmreGoals / teamEmreMatchStats.length) * 100) / 100 : 0,
      ...minutesStats(teamMatches),
    };
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
  const emreTotalYellow = emreStats.reduce((s, e) => s + e.yellowCards, 0);
  const emreTotalTwo = emreStats.reduce((s, e) => s + e.twoMinutes, 0);
  const emreTotalRed = emreStats.reduce((s, e) => s + e.redCards, 0);

  const avg = (n: number) =>
    emrePlayed > 0 ? Math.round((n / emrePlayed) * 100) / 100 : 0;

  const combinedEmreGoals = emreStats.reduce((s, e) => s + e.goals + e.sevenMeter, 0);
  const combinedMinutes = minutesStats(matches);

  const response: StatsResponse = {
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    perTeam,
    combined: {
      overall: combinedOverall,
      withEmre: combinedWithEmre,
      withoutEmre: combinedWithoutEmre,
      emreGoals: combinedEmreGoals,
      emreAvgGoals: avg(combinedEmreGoals),
      ...combinedMinutes,
    },
    emre: {
      matchesPlayed: emrePlayed,
      totalGoals: emreStats.reduce((s, e) => s + e.goals + e.sevenMeter, 0),
      totalYellowCards: emreTotalYellow,
      totalTwoMinutes: emreTotalTwo,
      totalRedCards: emreTotalRed,
      avgGoals: avg(emreStats.reduce((s, e) => s + e.goals + e.sevenMeter, 0)),
      avgYellowCards: avg(emreTotalYellow),
      avgTwoMinutes: avg(emreTotalTwo),
      ...combinedMinutes,
    },
  };

  return NextResponse.json(response);
}
