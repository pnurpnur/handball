import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel" }, { status: 400 });
  }

  const { minutesPlayed } = body as { minutesPlayed?: unknown };

  if (
    minutesPlayed !== null &&
    (typeof minutesPlayed !== "number" ||
      !Number.isInteger(minutesPlayed) ||
      minutesPlayed < 0 ||
      minutesPlayed > 200)
  ) {
    return NextResponse.json({ error: "Ugyldig antall minutter" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Kamp ikke funnet" }, { status: 404 });
  }

  const updated = await prisma.emreStats.upsert({
    where: { matchId },
    update: { minutesPlayed },
    create: { matchId, minutesPlayed },
  });

  return NextResponse.json({ minutesPlayed: updated.minutesPlayed });
}
