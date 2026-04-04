import "dotenv/config";
import { CronJob } from "cron";
import { scrapeAll, scrapeTeam } from "./scraper";
import { prisma } from "./db";
import { TEAM_IDS } from "./config";

const args = process.argv.slice(2);
const runOnce = args.includes("--once");
const teamArg = args.find((a) => a.startsWith("--team="));

/** Active post-match scrape timers, keyed by scheduled time (ms since epoch). */
const scheduledTimers = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Schedule scrapes 2 hours after each upcoming match starts.
 * Groups matches within 10 minutes of each other into a single scrape.
 * Clears any previously scheduled timers before rescheduling.
 */
async function scheduleMatchScrapes(): Promise<void> {
  // Cancel existing timers
  for (const timer of scheduledTimers.values()) clearTimeout(timer);
  scheduledTimers.clear();

  const now = new Date();
  const upcoming = await prisma.match.findMany({
    where: {
      date: { gt: now },
      isPlayed: false,
    },
    select: { date: true },
    orderBy: { date: "asc" },
  });

  if (upcoming.length === 0) {
    console.log("[Scheduler] No upcoming matches found.");
    return;
  }

  // Build list of unique scrape times (match start + 2h), grouped within 10 min
  const scrapeTimes: number[] = [];
  for (const match of upcoming) {
    if (!match.date) continue;
    const scrapeAt = match.date.getTime() + 2 * 60 * 60 * 1000; // +2 hours
    // Only add if no existing time is within 10 minutes
    const tenMin = 10 * 60 * 1000;
    if (!scrapeTimes.some((t) => Math.abs(t - scrapeAt) < tenMin)) {
      scrapeTimes.push(scrapeAt);
    }
  }

  let scheduled = 0;
  for (const scrapeAt of scrapeTimes) {
    const delay = scrapeAt - Date.now();
    if (delay <= 0) continue; // Already passed

    const timer = setTimeout(async () => {
      scheduledTimers.delete(scrapeAt);
      console.log(
        `[Scheduler] Post-match scrape triggered (scheduled for ${new Date(scrapeAt).toISOString()})`
      );
      await scrapeAll().catch(console.error);
      // Reschedule for any new matches added since last run
      await scheduleMatchScrapes().catch(console.error);
    }, delay);

    scheduledTimers.set(scrapeAt, timer);
    scheduled++;
    console.log(
      `[Scheduler] Scrape scheduled at ${new Date(scrapeAt).toLocaleString("no-NO", { timeZone: "Europe/Oslo" })}`
    );
  }

  console.log(
    `[Scheduler] ${scheduled} post-match scrape(s) scheduled from ${upcoming.length} upcoming matches.`
  );
}

async function main() {
  console.log("[Handball Scraper] Starting...");

  if (runOnce || teamArg) {
    if (teamArg) {
      const teamId = parseInt(teamArg.split("=")[1]);
      if (!TEAM_IDS.includes(teamId)) {
        console.error(`Unknown team ID: ${teamId}`);
        process.exit(1);
      }
      console.log(`Running single scrape for team ${teamId}...`);
      await scrapeTeam(teamId);
    } else {
      await scrapeAll();
    }
    await prisma.$disconnect();
    process.exit(0);
  }

  // Run immediately on startup, then schedule based on match times
  console.log("[Scraper] Initial scrape on startup...");
  await scrapeAll().catch(console.error);
  await scheduleMatchScrapes().catch(console.error);

  // Daily 08:00: catch any overnight results + reschedule for new matches
  const morningJob = new CronJob(
    "0 8 * * *",
    async () => {
      console.log("[Cron] Morning scrape...");
      await scrapeAll().catch(console.error);
      await scheduleMatchScrapes().catch(console.error);
    },
    null,
    true,
    "Europe/Oslo"
  );

  // Express server to receive webhook from Next.js /api/scrape
  const http = await import("http");
  const port = process.env.PORT || 3001;

  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/scrape") {
      const body = await new Promise<string>((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
      });

      let teamId: number | undefined;
      try {
        const json = JSON.parse(body);
        teamId = json.teamId;
      } catch {}

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));

      if (teamId && TEAM_IDS.includes(teamId)) {
        scrapeTeam(teamId).catch(console.error);
      } else {
        scrapeAll()
          .then(() => scheduleMatchScrapes())
          .catch(console.error);
      }
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }

    if (req.method === "GET" && req.url === "/schedule") {
      const times = Array.from(scheduledTimers.keys())
        .sort()
        .map((t) => new Date(t).toLocaleString("no-NO", { timeZone: "Europe/Oslo" }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ scheduled: times }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`[Scraper] HTTP server listening on port ${port}`);
    console.log(`[Scraper] Dynamic post-match scheduling active`);
  });

  process.on("SIGTERM", async () => {
    console.log("[Scraper] Shutting down...");
    morningJob.stop();
    for (const timer of scheduledTimers.values()) clearTimeout(timer);
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Scraper] Fatal error:", err);
  process.exit(1);
});
