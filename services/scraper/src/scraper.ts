import { chromium, Browser, Page } from "playwright";
import * as cheerio from "cheerio";
import { TEAM_IDS, EMRE_NAME, TEAM_PAGE, MATCH_PAGE, BASE_URL } from "./config";
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

async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Parse Norwegian date "dd.mm.yyyy hh:mm"
function parseNorDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = "12", minute = "00"] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
}

// Fetch team page using Playwright (Angular/AJAX page)
async function scrapeTeamPage(
  teamId: number
): Promise<{ teamName: string; matches: MatchRow[] }> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    console.log(`  Loading team page for ${teamId}...`);
    await page.goto(TEAM_PAGE(teamId), { waitUntil: "networkidle", timeout: 30000 });

    // Wait for match table to be populated
    await page.waitForSelector("table.matchlist tbody tr, .match-list tr", {
      timeout: 15000,
    }).catch(() => {
      // Some teams may have no matches yet
    });

    // Extract team name
    const teamName = await page
      .$eval(
        "h1.team-name, .team-header h1, h1",
        (el) => el.textContent?.trim() ?? ""
      )
      .catch(() => `Team ${teamId}`);

    const html = await page.content();
    const $ = cheerio.load(html);

    const matches: MatchRow[] = [];

    // Parse the all-matches table
    // handball.no uses a table with rows containing match info
    $("table tr, .matchlist tr").each((_i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;

      // Look for a link with matchid in it
      const matchLink = $(row).find('a[href*="matchid"], a[href*="kampid"]').attr("href");
      const matchIdMatch = matchLink?.match(/(?:matchid|kampid)=(\d+)/);
      if (!matchIdMatch) return;

      const matchId = matchIdMatch[1];
      const dateText = cells.eq(0).text().trim();
      const tournamentText = cells.eq(1).text().trim();

      // Score cell - contains "X - Y" if played, empty/dash if not
      const scoreText = $(row).find(".score, td:contains(' - ')").text().trim();
      const scoreMatch = scoreText.match(/(\d+)\s*[-–]\s*(\d+)/);

      let homeTeam = "";
      let awayTeam = "";
      const teamCells = $(row).find("td.team, td.home-team, td.away-team");
      if (teamCells.length >= 2) {
        homeTeam = teamCells.eq(0).text().trim();
        awayTeam = teamCells.eq(1).text().trim();
      } else {
        // Fallback: look for the match text
        const matchText = $(row).find("td").eq(2).text().trim();
        const teams = matchText.split(/[-–]/);
        homeTeam = teams[0]?.trim() ?? "";
        awayTeam = teams[1]?.trim() ?? "";
      }

      matches.push({
        matchId,
        date: dateText || null,
        homeTeam,
        awayTeam,
        homeScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
        awayScore: scoreMatch ? parseInt(scoreMatch[2]) : null,
        isPlayed: !!scoreMatch,
        tournament: tournamentText,
        venue: null,
      });
    });

    console.log(`  Found ${matches.length} matches for team ${teamId}`);
    return { teamName, matches };
  } finally {
    await page.close();
  }
}

// Fetch individual match details
async function scrapeMatchPage(matchId: string): Promise<MatchDetails | null> {
  const b = await getBrowser();
  const page: Page = await b.newPage();

  try {
    await page.goto(MATCH_PAGE(matchId), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    // Check if match exists
    if ($("body").text().includes("Kampen finnes ikke")) {
      return null;
    }

    // Extract teams and score
    const homeTeam =
      $(".home-team, .team-home, td.team:first-child").first().text().trim() ||
      $("h1").text().split(/[-–]/)[0]?.trim() ||
      "";

    const awayTeam =
      $(".away-team, .team-away, td.team:last-child").first().text().trim() ||
      $("h1").text().split(/[-–]/)[1]?.trim() ||
      "";

    // Score
    const scoreEl = $(".score, .result, .match-score").first();
    const scoreText = scoreEl.text().trim();
    const scoreMatch = scoreText.match(/(\d+)\s*[-–]\s*(\d+)/);

    // Date
    const dateText =
      $(".match-date, .date, time").first().text().trim() ||
      $("td:contains('.')").first().text().trim();
    const matchDate = parseNorDate(dateText);

    // Tournament
    const tournament =
      $(".tournament, .league, .serie, .competition").first().text().trim() ||
      $("h2, .match-type").first().text().trim() ||
      "";

    // Venue
    const venue =
      $(".venue, .arena, .hall").first().text().trim() || null;

    // Player stats – look through both team tables
    let emreInSquad = false;
    let emreStats: PlayerStats | null = null;

    $("table").each((_tableIdx, table) => {
      $(table)
        .find("tr")
        .each((_rowIdx, row) => {
          const cells = $(row).find("td");
          if (cells.length < 3) return;

          // Check if player name matches Emre
          const playerName = cells
            .filter((_, el) => {
              const text = $(el).text().trim();
              return text.length > 3 && !/^\d+$/.test(text);
            })
            .first()
            .text()
            .trim();

          if (
            playerName
              .toLowerCase()
              .includes(EMRE_NAME.toLowerCase().split(" ")[0]) &&
            playerName
              .toLowerCase()
              .includes(
                EMRE_NAME.toLowerCase().split(" ")[EMRE_NAME.split(" ").length - 1]
              )
          ) {
            emreInSquad = true;

            // Parse stats columns: Nr | Name | M | 7M | A | 2 | D
            // Find numeric stats – they appear after the name column
            const allCells = cells.map((_, el) => $(el).text().trim()).get();

            // Find the index of the name cell
            const nameIdx = allCells.findIndex((t) =>
              t.toLowerCase().includes(EMRE_NAME.toLowerCase().split(" ")[0])
            );

            const parseStatCell = (idx: number): number => {
              const val = allCells[nameIdx + idx];
              if (!val || val === "-" || val === "") return 0;
              return parseInt(val) || 0;
            };

            emreStats = {
              name: playerName,
              goals: parseStatCell(1),
              sevenMeter: parseStatCell(2),
              yellowCards: parseStatCell(3),
              twoMinutes: parseStatCell(4),
              redCards: parseStatCell(5),
            };
          }
        });
    });

    // Also check squad/tropp lists (players listed but without stats)
    if (!emreInSquad) {
      const bodyText = $("body").text();
      if (bodyText.toLowerCase().includes(EMRE_NAME.toLowerCase())) {
        emreInSquad = true;
      }
    }

    // Extract teams from stats table headers if not found yet
    let finalHomeTeam = homeTeam;
    let finalAwayTeam = awayTeam;
    if (!finalHomeTeam || !finalAwayTeam) {
      const h1Text = $("h1").first().text();
      const parts = h1Text.split(/\s*[-–]\s*/);
      finalHomeTeam = parts[0]?.trim() || "";
      finalAwayTeam = parts[1]?.trim() || "";
    }

    return {
      homeTeam: finalHomeTeam,
      awayTeam: finalAwayTeam,
      homeScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
      awayScore: scoreMatch ? parseInt(scoreMatch[2]) : null,
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

// More reliable match page scraping using cheerio directly after Playwright render
async function scrapeMatchDetails(matchId: string): Promise<MatchDetails | null> {
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

    // ---- Teams & Score ----
    // The page typically has a header like "Heimdal 2 - Malm" and a score "38 - 5"
    let homeTeam = "";
    let awayTeam = "";
    let homeScore: number | null = null;
    let awayScore: number | null = null;

    // Try to find teams from the match header section
    const pageTitle = $("title").text(); // e.g. "Kamp, Malm - Heimdal 2 | handball.no"
    const titleMatch = pageTitle.match(/^Kamp,\s*(.+?)\s*-\s*(.+?)\s*\|/);
    if (titleMatch) {
      homeTeam = titleMatch[1].trim();
      awayTeam = titleMatch[2].trim();
    }

    // Score from the page
    $("td, span, div").each((_i, el) => {
      const text = $(el).text().trim();
      const m = text.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
      if (m && !homeScore) {
        homeScore = parseInt(m[1]);
        awayScore = parseInt(m[2]);
      }
    });

    // Date
    let matchDate: Date | null = null;
    $("td, span, div, p").each((_i, el) => {
      const text = $(el).text().trim();
      if (!matchDate) {
        const d = parseNorDate(text);
        if (d) matchDate = d;
      }
    });

    // Tournament
    let tournament = "";
    $("a, span, td").each((_i, el) => {
      const text = $(el).text().trim();
      if (!tournament && (text.includes("serie") || text.includes("Serie") ||
          text.includes("Liga") || text.includes("NM") || text.includes("Cup") ||
          text.includes("krets") || text.includes("G1") || text.includes("J1") ||
          text.includes("MSr") || text.includes("WSr"))) {
        tournament = text;
      }
    });

    // Venue
    let venue: string | null = null;
    $("td, span").each((_i, el) => {
      const text = $(el).text().trim();
      if (!venue && (text.includes("hallen") || text.includes("hall") ||
          text.includes("arena") || text.includes("Arena"))) {
        venue = text;
      }
    });

    // ---- Emre's stats ----
    let emreInSquad = false;
    let emreStats: PlayerStats | null = null;

    const emreFirst = EMRE_NAME.split(" ")[0].toLowerCase();
    const emreLast = EMRE_NAME.split(" ").slice(-1)[0].toLowerCase();

    $("table").each((_ti, table) => {
      $(table).find("tr").each((_ri, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) return;

        let nameIdx = -1;
        let playerName = "";

        cells.each((ci, cell) => {
          const text = $(cell).text().trim().toLowerCase();
          if (text.includes(emreFirst) && text.includes(emreLast)) {
            nameIdx = ci;
            playerName = $(cell).text().trim();
          }
        });

        if (nameIdx === -1) return;

        emreInSquad = true;

        // Stat columns come AFTER the name column (M, 7M, A, 2, D)
        // Sometimes there's a jersey number before the name
        const allVals = cells.map((_, c) => $(c).text().trim()).get();

        const parseAfter = (offset: number): number => {
          const v = allVals[nameIdx + offset];
          if (!v || v === "-" || v === "") return 0;
          const n = parseInt(v);
          return isNaN(n) ? 0 : n;
        };

        emreStats = {
          name: playerName,
          goals: parseAfter(1),
          sevenMeter: parseAfter(2),
          yellowCards: parseAfter(3),
          twoMinutes: parseAfter(4),
          redCards: parseAfter(5),
        };
      });
    });

    // Fallback: just check if name appears anywhere in the page
    if (!emreInSquad) {
      const bodyText = $("body").text().toLowerCase();
      if (bodyText.includes(emreFirst) && bodyText.includes(emreLast)) {
        emreInSquad = true;
      }
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
    console.error(`Error scraping match ${matchId}:`, err);
    return null;
  } finally {
    await page.close();
  }
}

// Scrape team page to get match list
async function getMatchIdsForTeam(
  teamId: number
): Promise<{ teamName: string; matchIds: string[]; tournament: string }> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    console.log(`  Fetching match list for team ${teamId}...`);
    await page.goto(TEAM_PAGE(teamId), {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Give Angular extra time to render
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);

    // Team name from h1 or title
    const teamName =
      $("h1").first().text().trim() ||
      $("title")
        .text()
        .replace("| handball.no", "")
        .trim() ||
      `Team ${teamId}`;

    // Tournament from breadcrumb or header
    const tournament =
      $(".breadcrumb li").last().text().trim() ||
      $("h2, .league-name").first().text().trim() ||
      "";

    // Find all match links
    const matchIds: string[] = [];
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/(?:matchid|kampid)=(\d+)/);
      if (m && !matchIds.includes(m[1])) {
        matchIds.push(m[1]);
      }
    });

    console.log(
      `  Team: "${teamName}", Tournament: "${tournament}", Matches: ${matchIds.length}`
    );
    return { teamName, matchIds, tournament };
  } finally {
    await page.close();
  }
}

// Main scrape function for a single team
export async function scrapeTeam(teamId: number): Promise<number> {
  const start = Date.now();
  let matchesUpdated = 0;

  try {
    const { teamName, matchIds, tournament } = await getMatchIdsForTeam(teamId);

    // Upsert team
    await prisma.team.upsert({
      where: { id: teamId },
      update: { name: teamName, updatedAt: new Date() },
      create: { id: teamId, name: teamName },
    });

    console.log(`  Processing ${matchIds.length} matches for ${teamName}...`);

    for (const matchId of matchIds) {
      try {
        // Check if we already have fresh data for this match
        const existing = await prisma.match.findUnique({
          where: { id: matchId },
          include: { emreStats: true },
        });

        // Skip if match is played and we have full data (with Emre check done)
        if (
          existing?.isPlayed &&
          existing.scrapedAt &&
          Date.now() - existing.scrapedAt.getTime() < 1000 * 60 * 60 * 6 // 6 hours
        ) {
          continue;
        }

        const details = await scrapeMatchDetails(matchId);
        if (!details) continue;

        // Upsert match
        await prisma.match.upsert({
          where: { id: matchId },
          update: {
            teamId,
            tournament: details.tournament || tournament,
            date: details.date ?? existing?.date,
            homeTeam: details.homeTeam || existing?.homeTeam || "",
            awayTeam: details.awayTeam || existing?.awayTeam || "",
            homeScore: details.homeScore,
            awayScore: details.awayScore,
            isPlayed:
              details.homeScore !== null && details.awayScore !== null,
            venue: details.venue ?? existing?.venue,
            emreInSquad: details.emreInSquad,
            scrapedAt: new Date(),
          },
          create: {
            id: matchId,
            teamId,
            tournament: details.tournament || tournament,
            date: details.date,
            homeTeam: details.homeTeam,
            awayTeam: details.awayTeam,
            homeScore: details.homeScore,
            awayScore: details.awayScore,
            isPlayed:
              details.homeScore !== null && details.awayScore !== null,
            venue: details.venue,
            emreInSquad: details.emreInSquad,
            scrapedAt: new Date(),
          },
        });

        // Upsert Emre's stats if present
        if (details.emreInSquad && details.emreStats) {
          await prisma.emreStats.upsert({
            where: { matchId },
            update: {
              goals: details.emreStats.goals,
              sevenMeter: details.emreStats.sevenMeter,
              yellowCards: details.emreStats.yellowCards,
              twoMinutes: details.emreStats.twoMinutes,
              redCards: details.emreStats.redCards,
            },
            create: {
              matchId,
              goals: details.emreStats.goals,
              sevenMeter: details.emreStats.sevenMeter,
              yellowCards: details.emreStats.yellowCards,
              twoMinutes: details.emreStats.twoMinutes,
              redCards: details.emreStats.redCards,
            },
          });
        } else if (!details.emreInSquad) {
          // Remove stats if Emre is no longer in the squad
          await prisma.emreStats.deleteMany({ where: { matchId } });
        }

        matchesUpdated++;
      } catch (matchErr) {
        console.error(`  Error processing match ${matchId}:`, matchErr);
      }
    }

    // Log success
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

// Scrape all teams
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
  console.log(
    `[Scraper] Done. Total matches updated: ${totalUpdated}`
  );
}
