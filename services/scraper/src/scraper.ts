import { chromium, Browser } from "playwright";
import * as cheerio from "cheerio";
import { TEAM_IDS, EMRE_NAME, TEAM_PAGE, MATCH_PAGE } from "./config";
import { prisma } from "./db";

interface MatchRow {
  matchId: string;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
  tournament: string;
  venue: string | null;
}

interface PlayerStats {
  name: string;
  goals: number;
  sevenMeter: number;
  yellowCards: number;
  twoMinutes: number;
  redCards: number;
}

interface MatchDetails {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  tournament: string;
  date: Date | null;
  venue: string | null;
  emreInSquad: boolean;
  emreStats: PlayerStats | null;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Parse Norwegian date strings:
 *   "22.03.26 14:30"        (2-digit year, from team page)
 *   "22.03.2026 kl. 14:30"  (4-digit year, from match page)
 */
function parseNorDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(
    /(\d{2})\.(\d{2})\.(\d{2,4})(?:.*?(\d{2}):(\d{2}))?/
  );
  if (!m) return null;
  const day = m[1];
  const month = m[2];
  const yearRaw = m[3];
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const hour = m[4] ?? "12";
  const minute = m[5] ?? "00";
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
}

/**
 * Scrape the team page and extract all match data from print-only tables.
 *
 * Page structure (table.print-only):
 *   Row 0 (header): Tid | Kampnr | Bane | Hjemmelag | Bortelag | H-B
 *   Row N (data):   22.03.26 14:30 | 11119302107 | Stamneshallen | Sandnessjøen | Tiller 2 | 28-40
 *
 * H-B values:
 *   "28-40"  → played, homeScore=28 awayScore=40
 *   "0-IM"   → walkover / not played
 *   "-"      → not yet played
 */
async function scrapeTeamPage(teamId: number): Promise<{
  teamName: string;
  tournament: string;
  matches: MatchRow[];
}> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    console.log(`  Loading team page for ${teamId}...`);
    await page.goto(TEAM_PAGE(teamId), {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    // Title: "Lag, Tiller 2 - MS- 2 | handball.no"
    const titleText = $("title").text();
    const titleMatch = titleText.match(/^Lag,\s*(.+?)\s*\|/);
    const teamName = titleMatch ? titleMatch[1].trim() : `Team ${teamId}`;

    // Tournament from title suffix "Tiller 2 - MS- 2"
    const tournamentMatch = titleText.match(/^Lag,\s*.+?\s*-\s*(.+?)\s*\|/);
    const defaultTournament = tournamentMatch
      ? tournamentMatch[1].trim()
      : "";

    const matches: MatchRow[] = [];

    $("table.print-only").each((_ti, table) => {
      // Tournament name is inside the same .table-outer container as a <b class="row">
      // e.g. <b class="row">Turnering: Gutter 20 år, NTE MidtNorge-serien - 02</b>
      let tableTournament = defaultTournament;
      const bRow = $(table).closest(".table-outer").find("b.row").first();
      if (bRow.length) {
        tableTournament = bRow.text().trim().replace(/^Turnering:\s*/i, "");
      }

      // Skip header row (index 0)
      $(table)
        .find("tr")
        .slice(1)
        .each((_ri, row) => {
          const cells = $(row).find("td");
          if (cells.length < 5) return;

          const dateText = cells.eq(0).text().trim(); // "22.03.26 14:30"
          // cells.eq(1) = Kampnr (unused here)
          const venue = cells.eq(2).text().trim();    // "Stamneshallen"
          const homeTeam = cells.eq(3).text().trim(); // "Sandnessjøen"
          const awayTeam = cells.eq(4).text().trim(); // "Tiller 2"
          const hbText = cells.eq(5).text().trim();   // "28-40" or "0-IM" or "-"

          const link = $(row).find('a[href*="matchid"]').attr("href");
          const matchIdMatch = link?.match(/matchid=(\d+)/);
          if (!matchIdMatch) return;

          const matchId = matchIdMatch[1];

          // Parse H-B score: "28-40" (both numeric = played)
          let homeScore: number | null = null;
          let awayScore: number | null = null;
          let isPlayed = false;

          const scoreMatch = hbText.match(/^(\d+)-(\d+)$/);
          if (scoreMatch) {
            homeScore = parseInt(scoreMatch[1]);
            awayScore = parseInt(scoreMatch[2]);
            isPlayed = true;
          }
          // "0-IM", "-", "" → isPlayed stays false

          matches.push({
            matchId,
            date: dateText || null,
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            isPlayed,
            tournament: tableTournament,
            venue: venue || null,
          });
        });
    });

    console.log(
      `  "${teamName}": found ${matches.length} matches (${matches.filter((m) => m.isPlayed).length} played)`
    );
    return { teamName, tournament: defaultTournament, matches };
  } finally {
    await page.close();
  }
}

/**
 * Scrape individual match page for detailed info and Emre's stats.
 *
 * Match info table (unnamed, first table on page):
 *   Row 0: "28 (13)"     | "Sandnessjøen"                          → homeScore | homeTeam
 *   Row 1: "40 (19)"     | "Tiller 2"                              → awayScore | awayTeam
 *   Row 2: "Dato / Tid:" | "22.03.2026 kl. 14:30"
 *   Row 3: "Turnering:"  | "3. divisjon Menn, NTE MidtNorge-serien"
 *   Row 4: "Sted:"       | "Stamneshallen"
 *
 * Player stats tables (table.player-table):
 *   Header: Nr | Spiller | M | 7M | A | 2 | D | R
 */
async function scrapeMatchDetails(
  matchId: string
): Promise<MatchDetails | null> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.goto(MATCH_PAGE(matchId), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    if ($("body").text().includes("Kampen finnes ikke")) return null;

    // --- Teams from page title ---
    // "Kamp, Sandnessjøen - Tiller 2 | handball.no"
    const titleText = $("title").text();
    const titleMatch = titleText.match(/^Kamp,\s*(.+?)\s*-\s*(.+?)\s*\|/);
    let homeTeam = titleMatch ? titleMatch[1].trim() : "";
    let awayTeam = titleMatch ? titleMatch[2].trim() : "";

    // --- Score, date, tournament, venue from match info table ---
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let matchDate: Date | null = null;
    let tournament = "";
    let venue: string | null = null;

    // First non-cookie table is the match info table
    const infoTable = $("table")
      .filter((_i, el) => !$(el).hasClass("coi-consent-banner__found-cookies"))
      .first();

    infoTable.find("tr").each((rowIdx, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const col0 = cells.eq(0).text().trim();
      const col1 = cells.eq(1).text().trim();

      if (rowIdx === 0) {
        // "28 (13)" → extract first number
        const m = col0.match(/^(\d+)/);
        if (m) homeScore = parseInt(m[1]);
        if (!homeTeam) homeTeam = col1;
      } else if (rowIdx === 1) {
        // "40 (19)" → extract first number
        const m = col0.match(/^(\d+)/);
        if (m) awayScore = parseInt(m[1]);
        if (!awayTeam) awayTeam = col1;
      } else if (col0.startsWith("Dato")) {
        matchDate = parseNorDate(col1);
      } else if (col0.startsWith("Turnering")) {
        tournament = col1;
      } else if (col0.startsWith("Sted")) {
        venue = col1 || null;
      }
    });

    // --- Emre's stats from player tables ---
    let emreInSquad = false;
    let emreStats: PlayerStats | null = null;

    const emreFirst = EMRE_NAME.split(" ")[0].toLowerCase();
    const emreLast = EMRE_NAME.split(" ").slice(-1)[0].toLowerCase();

    // table.player-table: Nr | Spiller | M | 7M | A | 2 | D | R
    $("table.player-table").each((_ti, table) => {
      $(table)
        .find("tr")
        .each((_ri, row) => {
          const cells = $(row).find("td");
          if (cells.length < 3) return;

          let nameIdx = -1;
          cells.each((ci, cell) => {
            const text = $(cell).text().trim().toLowerCase();
            if (text.includes(emreFirst) && text.includes(emreLast)) {
              nameIdx = ci;
            }
          });

          if (nameIdx === -1) return;

          emreInSquad = true;
          const allVals = cells.map((_, c) => $(c).text().trim()).get();

          const parseStat = (offset: number): number => {
            const v = allVals[nameIdx + offset];
            if (!v || v === "-" || v === "") return 0;
            return parseInt(v) || 0;
          };

          emreStats = {
            name: cells.eq(nameIdx).text().trim(),
            goals: parseStat(1),      // M
            sevenMeter: parseStat(2), // 7M
            yellowCards: parseStat(3), // A
            twoMinutes: parseStat(4), // 2
            redCards: parseStat(5),   // D
          };
        });
    });

    return {
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      tournament,
      date: matchDate,
      venue,
      emreInSquad,
      emreStats,
    };
  } catch (err) {
    console.error(`Error scraping match ${matchId}:`, err);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Main scrape function for a single team.
 * Strategy:
 *  1. Parse team page (print-only tables) → get scores, dates, teams, venue
 *  2. For played matches: also fetch match page → get tournament name + Emre stats
 *  3. For unplayed matches: store basic data only (no match page fetch needed)
 */
export async function scrapeTeam(teamId: number): Promise<number> {
  const start = Date.now();
  let matchesUpdated = 0;

  try {
    const { teamName, matches } = await scrapeTeamPage(teamId);

    await prisma.team.upsert({
      where: { id: teamId },
      update: { name: teamName, updatedAt: new Date() },
      create: { id: teamId, name: teamName },
    });

    for (const match of matches) {
      try {
        const existing = await prisma.match.findUnique({
          where: { id: match.matchId },
          include: { emreStats: true },
        });

        // Always re-scrape played matches to ensure stats are correct.
        // Unplayed matches are always checked in case they've been played.

        const parsedDate = match.date ? parseNorDate(match.date) : null;

        if (match.isPlayed) {
          // Fetch match page for tournament details and Emre stats
          const details = await scrapeMatchDetails(match.matchId);

          await prisma.match.upsert({
            where: { id: match.matchId },
            update: {
              teamId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: match.homeScore,   // from team page H-B column (reliable)
              awayScore: match.awayScore,
              isPlayed: true,
              date: parsedDate ?? existing?.date,
              venue: match.venue || details?.venue || existing?.venue,
              tournament:
                details?.tournament || match.tournament || existing?.tournament || "",
              emreInSquad: details?.emreInSquad ?? false,
              scrapedAt: new Date(),
            },
            create: {
              id: match.matchId,
              teamId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              isPlayed: true,
              date: parsedDate,
              venue: match.venue || details?.venue,
              tournament: details?.tournament || match.tournament || "",
              emreInSquad: details?.emreInSquad ?? false,
              scrapedAt: new Date(),
            },
          });

          if (details?.emreInSquad && details.emreStats) {
            await prisma.emreStats.upsert({
              where: { matchId: match.matchId },
              update: {
                goals: details.emreStats.goals,
                sevenMeter: details.emreStats.sevenMeter,
                yellowCards: details.emreStats.yellowCards,
                twoMinutes: details.emreStats.twoMinutes,
                redCards: details.emreStats.redCards,
              },
              create: {
                matchId: match.matchId,
                goals: details.emreStats.goals,
                sevenMeter: details.emreStats.sevenMeter,
                yellowCards: details.emreStats.yellowCards,
                twoMinutes: details.emreStats.twoMinutes,
                redCards: details.emreStats.redCards,
              },
            });
          } else if (details && !details.emreInSquad) {
            await prisma.emreStats.deleteMany({
              where: { matchId: match.matchId },
            });
          }
        } else {
          // Unplayed match – fetch match page for accurate tournament name and venue
          const details = await scrapeMatchDetails(match.matchId);

          await prisma.match.upsert({
            where: { id: match.matchId },
            update: {
              teamId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: null,
              awayScore: null,
              isPlayed: false,
              date: parsedDate ?? existing?.date,
              venue: match.venue || details?.venue || existing?.venue,
              tournament:
                details?.tournament || match.tournament || existing?.tournament || "",
              scrapedAt: new Date(),
            },
            create: {
              id: match.matchId,
              teamId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: null,
              awayScore: null,
              isPlayed: false,
              date: parsedDate,
              venue: match.venue || details?.venue,
              tournament: details?.tournament || match.tournament || "",
              scrapedAt: new Date(),
            },
          });
        }

        matchesUpdated++;
      } catch (matchErr) {
        console.error(
          `  Error processing match ${match.matchId}:`,
          matchErr
        );
      }
    }

    await prisma.scrapeLog.create({
      data: {
        teamId,
        status: "success",
        matchesUpdated,
        duration: Date.now() - start,
      },
    });

    return matchesUpdated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scrapeLog.create({
      data: {
        teamId,
        status: "error",
        message,
        duration: Date.now() - start,
      },
    });
    throw err;
  }
}

export async function scrapeAll(): Promise<void> {
  console.log(`[Scraper] Starting full scrape at ${new Date().toISOString()}`);
  let totalUpdated = 0;

  for (const teamId of TEAM_IDS) {
    try {
      console.log(`[Scraper] Processing team ${teamId}...`);
      const updated = await scrapeTeam(teamId);
      totalUpdated += updated;
      console.log(`[Scraper] Team ${teamId}: ${updated} matches updated`);
    } catch (err) {
      console.error(`[Scraper] Failed for team ${teamId}:`, err);
    }
  }

  await closeBrowser();
  console.log(`[Scraper] Done. Total matches updated: ${totalUpdated}`);
}
