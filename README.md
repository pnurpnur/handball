# Emre Handball Tracker

Webapp som henter og viser Emre Askim Pettersens håndballkamper fra handball.no.

## Arkitektur

```
Vercel (Next.js)  ←→  Railway (PostgreSQL + Scraper)
```

- **Frontend**: Next.js 14 med Tailwind CSS (Vercel)
- **Scraper**: Node.js + Playwright + Cron (Railway)
- **Database**: PostgreSQL (Railway)

## Kom i gang

### 1. Installer avhengigheter

```bash
npm install
npx playwright install chromium
```

### 2. Database

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/scraper/.env.example services/scraper/.env
# Oppdater DATABASE_URL i begge filene
npm run db:migrate
```

### 3. Start lokalt

```bash
npm run dev        # Starter begge tjenester
```

Eller separat:
```bash
npm run dev --workspace=apps/web        # Next.js på port 3000
npm run dev --workspace=services/scraper  # Scraper på port 3001
```

### 4. Kjør scraper manuelt

```bash
cd services/scraper
npx ts-node src/index.ts --once            # Alle lag
npx ts-node src/index.ts --once --team=928241  # Ett lag
```

## Deployment

### Railway – PostgreSQL

1. Nytt prosjekt → legg til PostgreSQL-plugin
2. Kopier `DATABASE_URL` fra plugin-innstillinger

### Railway – Scraper

1. Legg til ny service fra GitHub-repo
2. Sett Dockerfile path: `services/scraper/Dockerfile`
3. Env-variabler: `DATABASE_URL`

### Vercel – Frontend

1. Importer GitHub-repo
2. Build command: `npm run db:generate && npm run build --workspace=apps/web`
3. Output directory: `apps/web/.next`
4. Env-variabler: `DATABASE_URL`, `SCRAPER_URL`, `SCRAPE_SECRET`

## Lag-IDer

| ID     |
|--------|
| 928241 |
| 771912 |
| 709787 |
| 682520 |
| 698373 |

## Scraper-schedule (Europe/Oslo)

| Tid                     | Trigger                    |
|------------------------|----------------------------|
| Oppstart               | Umiddelbar kjøring         |
| Daglig 08:00           | Morgenoppdatering          |
| Lø/Sø 17:00, 19:00, 21:00 | Etter kamptider         |
| POST /scrape (webhook) | Manuell trigger            |
