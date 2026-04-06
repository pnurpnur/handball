import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MatchData } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const status = searchParams.get("status"); // "played" | "upcoming" | "all"

  const where: Record<string, unknown> = {};

  if (teamId && teamId !== "all") {
    where.teamId = parseInt(teamId);
  }

  if (status === "played") {
    where.isPlayed = true;
  } else if (status === "upcoming") {
    where.isPlayed = false;
  }

  const matches = await prisma.match.findMany({
    where,
    include: {
      team: { select: { id: true, name: true } },
      emreStats: true,
    },
    orderBy: { date: "asc" },
  });

  const data: MatchData[] = matches.map((m) => ({
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

  return NextResponse.json(data);
}
