import * as cheerio from "cheerio";
import axios from "axios";
import {
  TEAM_IDS,
  TEAM_CONFIG,
  CURRENT_SEASON_ID,
  CURRENT_SEASON_NAME,
  HANDBALL_SEASON_ID,
  EMRE_NAME,
  MATCH_PAGE,
  TERMINLISTE_API,
  BASE_URL,
} from "./config";
import { prisma } from "./db";
import { formatError } from "./util";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Creates the current season row on first use each run; no-op afterwards. */
async function ensureSeason(): Promise<void> {
  await prisma.season.upsert({
    where: { id: CURRENT_SEASON_ID },
    update: {},
    create: { id: CURRENT_SEASON_ID, name: CURRENT_SEASON_NAME },
  });
}

interface MatchRow {
  matchId: string;
  date: Date | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
  tournament: string;
  venue: string | null;
}

/** One match entry from handball.no's TerminListeForTeam JSON API. */
interface ApiMatch {
  matchId: number;
  tournamentName: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  matchDate: string; // "2026-08-30T00:00:00" (date only, time is separate)
  matchStartTime: number; // e.g. 1300 = 13:00
  venueUnitName: string | null;
  goalsHome: number | null;
  goalsAway: number | null;
}

interface TerminlisteApiResponse {
  matches: ApiMatch[];
}

/** One player entry from the match page's <match-info> :home-players / :away-players JSON props. */
interface ApiPlayer {
  firstName: string;
  lastName: string;
  fullName: string;
  spillerMaal: number; // field goals (excludes penalties)
  sjuMeterMaal: number; // 7m/penalty goals
  toMinutter: number; // 2-minute suspensions
  advarsel: number; // yellow cards
  diskvalifikasjon: number; // red cards
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
 * Fetch a team's full fixture list from handball.no's own JSON API
 * (the same endpoint the site's "Excel export" and match list are built
 * from). This replaced the old print-only HTML table after a site
 * redesign switched the team page to a client-rendered SPA with no
 * server-rendered match table.
 */
async function fetchTeamMatches(teamId: number): Promise<{
  teamName: string;
  matches: MatchRow[];
}> {
  const url = TERMINLISTE_API(teamId, HANDBALL_SEASON_ID);
  console.log(`  Fetching fixture list for ${teamId}...`);

  const headers = {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: `${BASE_URL}/system/kamper/lag/?lagid=${teamId}`,
  };

  // handball.no rate-limits this endpoint; retry a couple of times with
  // backoff on 429 before giving up on this team for this run.
  let lastErr: unknown;
  let data: TerminlisteApiResponse | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5000 * attempt);
    try {
      const res = await axios.get<TerminlisteApiResponse>(url, {
        headers,
        timeout: 20000,
      });
      data = res.data;
      break;
    } catch (err) {
      lastErr = err;
      if (!axios.isAxiosError(err) || err.response?.status !== 429) throw err;
      console.log(`  Rate limited fetching ${teamId}, retrying (attempt ${attempt + 1})...`);
    }
  }
  if (!data) throw lastErr;

  let teamName = `Team ${teamId}`;
  const matches: MatchRow[] = (data.matches ?? []).map((m) => {
    const homeTeam = m.homeTeamName.trim();
    const awayTeam = m.awayTeamName.trim();

    if (m.homeTeamId === teamId) teamName = homeTeam;
    else if (m.awayTeamId === teamId) teamName = awayTeam;

    const date = new Date(m.matchDate);
    const hour = Math.floor(m.matchStartTime / 100);
    const minute = m.matchStartTime % 100;
    date.setHours(hour, minute, 0, 0);

    const isPlayed = m.goalsHome !== null && m.goalsAway !== null;

    return {
      matchId: String(m.matchId),
      date,
      homeTeam,
      awayTeam,
      homeScore: m.goalsHome,
      awayScore: m.goalsAway,
      isPlayed,
      tournament: m.tournamentName,
      venue: m.venueUnitName,
    };
  });

  console.log(
    `  "${teamName}": found ${matches.length} matches (${matches.filter((m) => m.isPlayed).length} played)`
  );
  return { teamName, matches };
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
 * Player stats are server-rendered as JSON in the ":home-players" and
 * ":away-players" attributes of a <match-info> element (a Vue component
 * whose props are baked into the initial HTML — no client-side JS needed
 * to read them).
 */
async function scrapeMatchDetails(
  matchId: string
): Promise<MatchDetails | null> {
  try {
    const { data: html } = await axios.get<string>(MATCH_PAGE(matchId), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 20000,
    });
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

    // --- Emre's stats from the <match-info> component's JSON props ---
    let emreInSquad = false;
    let emreStats: PlayerStats | null = null;

    const emreFirst = EMRE_NAME.split(" ")[0].toLowerCase();
    const emreLast = EMRE_NAME.split(" ").slice(-1)[0].toLowerCase();

    const matchInfoEl = $("match-info").first();
    const parsePlayers = (attr: string): ApiPlayer[] => {
      const raw = matchInfoEl.attr(attr);
      if (!raw) return [];
      try {
        return JSON.parse(raw) as ApiPlayer[];
      } catch {
        return [];
      }
    };
    const allPlayers = [
      ...parsePlayers(":home-players"),
      ...parsePlayers(":away-players"),
    ];

    const emrePlayer = allPlayers.find((p) => {
      const full = `${p.firstName} ${p.lastName}`.toLowerCase();
      return full.includes(emreFirst) && full.includes(emreLast);
    });

    if (emrePlayer) {
      emreInSquad = true;
      emreStats = {
        name: emrePlayer.fullName,
        goals: emrePlayer.spillerMaal,
        sevenMeter: emrePlayer.sjuMeterMaal,
        yellowCards: emrePlayer.advarsel,
        twoMinutes: emrePlayer.toMinutter,
        redCards: emrePlayer.diskvalifikasjon,
      };
    }

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
    console.error(`Error scraping match ${matchId}: ${formatError(err)}`);
    return null;
  }
}

/**
 * Main scrape function for a single team.
 * Strategy:
 *  1. Fetch the team's fixture list from handball.no's JSON API → scores, dates, teams, venue
 *  2. For played matches: also fetch match page → get tournament name + Emre stats
 *  3. For unplayed matches: store basic data only (no match page fetch needed)
 */
export async function scrapeTeam(teamId: number): Promise<number> {
  const start = Date.now();
  let matchesUpdated = 0;

  try {
    await ensureSeason();

    const { teamName, matches } = await fetchTeamMatches(teamId);
    const matchLength = TEAM_CONFIG[teamId]?.matchLength;

    await prisma.team.upsert({
      where: { id: teamId },
      update: { name: teamName, matchLengthMinutes: matchLength, updatedAt: new Date() },
      create: { id: teamId, name: teamName, matchLengthMinutes: matchLength },
    });

    for (const match of matches) {
      try {
        const existing = await prisma.match.findUnique({
          where: { id: match.matchId },
          include: { emreStats: true },
        });

        // Always re-scrape played matches to ensure stats are correct.
        // Unplayed matches are always checked in case they've been played.

        if (match.isPlayed) {
          // Fetch match page for tournament details and Emre stats
          const details = await scrapeMatchDetails(match.matchId);

          await prisma.match.upsert({
            where: { id: match.matchId },
            update: {
              teamId,
              seasonId: CURRENT_SEASON_ID,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: match.homeScore,   // from handball.no's fixture API (reliable)
              awayScore: match.awayScore,
              isPlayed: true,
              date: match.date ?? existing?.date,
              venue: match.venue || details?.venue || existing?.venue,
              tournament:
                match.tournament || details?.tournament || existing?.tournament || "",
              emreInSquad: details?.emreInSquad ?? false,
              scrapedAt: new Date(),
            },
            create: {
              id: match.matchId,
              teamId,
              seasonId: CURRENT_SEASON_ID,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              isPlayed: true,
              date: match.date,
              venue: match.venue || details?.venue,
              tournament: match.tournament || details?.tournament || "",
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
          // Unplayed match – the fixture-list API already has reliable
          // tournament/venue/date, no need to fetch the match-detail page.
          await prisma.match.upsert({
            where: { id: match.matchId },
            update: {
              teamId,
              seasonId: CURRENT_SEASON_ID,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: null,
              awayScore: null,
              isPlayed: false,
              date: match.date ?? existing?.date,
              venue: match.venue || existing?.venue,
              tournament: match.tournament || existing?.tournament || "",
              scrapedAt: new Date(),
            },
            create: {
              id: match.matchId,
              teamId,
              seasonId: CURRENT_SEASON_ID,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: null,
              awayScore: null,
              isPlayed: false,
              date: match.date,
              venue: match.venue,
              tournament: match.tournament || "",
              scrapedAt: new Date(),
            },
          });
        }

        matchesUpdated++;
      } catch (matchErr) {
        console.error(
          `  Error processing match ${match.matchId}: ${formatError(matchErr)}`
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
    const message = formatError(err);
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
      console.error(`[Scraper] Failed for team ${teamId}: ${formatError(err)}`);
    }
    // Space out requests between teams to avoid tripping handball.no's rate limit.
    await sleep(3000);
  }

  console.log(`[Scraper] Done. Total matches updated: ${totalUpdated}`);
}
