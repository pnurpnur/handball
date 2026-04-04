import "dotenv/config";
import { CronJob } from "cron";
import { scrapeAll, scrapeTeam } from "./scraper";
import { prisma } from "./db";
import { TEAM_IDS } from "./config";

const args = process.argv.slice(2);
const runOnce = args.includes("--once");
const teamArg = args.find((a) => a.startsWith("--team="));

async function main() {
  console.log("[Handball Scraper] Starting...");

  if (runOnce || teamArg) {
    // Manual / one-shot run
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

  // Run immediately on startup
  console.log("[Scraper] Initial scrape on startup...");
  await scrapeAll().catch(console.error);

  // Schedule: every day at 08:00 (picks up overnight results)
  const morningJob = new CronJob(
    "0 8 * * *",
    () => {
      console.log("[Cron] Morning scrape...");
      scrapeAll().catch(console.error);
    },
    null,
    true,
    "Europe/Oslo"
  );

  // Schedule: Saturday and Sunday at 17:00, 19:00, 21:00 (after matches)
  const weekendJob = new CronJob(
    "0 17,19,21 * * 6,0",
    () => {
      console.log("[Cron] Weekend evening scrape...");
      scrapeAll().catch(console.error);
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
      // Verify secret
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

      // Trigger scrape async
      if (teamId && TEAM_IDS.includes(teamId)) {
        scrapeTeam(teamId).catch(console.error);
      } else {
        scrapeAll().catch(console.error);
      }
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`[Scraper] HTTP server listening on port ${port}`);
    console.log(`[Scraper] Cron jobs active (Europe/Oslo timezone)`);
  });

  process.on("SIGTERM", async () => {
    console.log("[Scraper] Shutting down...");
    morningJob.stop();
    weekendJob.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Scraper] Fatal error:", err);
  process.exit(1);
});
