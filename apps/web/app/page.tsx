import { prisma } from "@/lib/prisma";
import ClientApp from "./ClientApp";
import type { MatchData, TeamData, SeasonData } from "@/lib/types";

export const revalidate = 300; // Revalidate every 5 minutes (ISR)

const TEAM_ORDER = [698373, 771912, 682520, 709787, 928241];

async function getSeasons(): Promise<SeasonData[]> {
  return prisma.season.findMany({ orderBy: { id: "desc" } });
}

async function getTeams(): Promise<TeamData[]> {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  return teams.sort((a, b) => {
    const ai = TEAM_ORDER.indexOf(a.id);
    const bi = TEAM_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
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
    seasonId: m.seasonId,
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

export default async function HomePage() {
  const [seasons, teams, matches] = await Promise.all([
    getSeasons(),
    getTeams(),
    getMatches(),
  ]);

  return (
    <ClientApp
      initialMatches={matches}
      teams={teams}
      seasons={seasons}
    />
  );
}
