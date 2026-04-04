import { NextRequest, NextResponse } from "next/server";

const SCRAPER_URL = process.env.SCRAPER_URL || "http://localhost:3001";
const SCRAPE_SECRET = process.env.SCRAPE_SECRET || "";

export async function POST(req: NextRequest) {
  // Simple secret check to prevent abuse
  const auth = req.headers.get("x-scrape-secret");
  if (SCRAPE_SECRET && auth !== SCRAPE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const res = await fetch(`${SCRAPER_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    return NextResponse.json({ ok: res.ok, triggered: true });
  } catch {
    return NextResponse.json(
      { error: "Could not reach scraper service" },
      { status: 503 }
    );
  }
}
