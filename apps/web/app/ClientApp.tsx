"use client";

import { useState, useMemo } from "react";
import type { MatchData, StatsResponse, TeamData, SeasonData, TeamStats } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import MatchTable from "@/components/MatchTable";
import MatchFilters from "@/components/MatchFilters";
import StatsView from "@/components/StatsView";

interface Props {
  initialMatches: MatchData[];
  teams: TeamData[];
  seasons: SeasonData[];
}

type Tab = "kamper" | "statistikk";
type ViewMode = "table" | "cards";
type SortKey = "date_asc" | "date_desc" | "goals_desc" | "margin_desc" | "margin_asc";

function getMargin(m: MatchData): number | null {
  if (!m.isPlayed || m.homeScore === null || m.awayScore === null) return null;
  const firstWord = m.teamName.toLowerCase().split(" ")[0];
  const isHome = m.homeTeam.toLowerCase().includes(firstWord);
  return isHome ? m.homeScore - m.awayScore! : m.awayScore! - m.homeScore;
}

type S = { played: number; won: number; draw: number; lost: number; goalsFor: number; goalsAgainst: number };
const emptyS = (): S => ({ played: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 });

function addResult(s: S, match: MatchData, teamName: string) {
  if (!match.isPlayed || match.homeScore === null || match.awayScore === null) return;
  const isHome = match.homeTeam.toLowerCase().includes(teamName.toLowerCase().split(" ")[0]);
  const tf = isHome ? match.homeScore : match.awayScore!;
  const ta = isHome ? match.awayScore! : match.homeScore;
  s.played++;
  s.goalsFor += tf;
  s.goalsAgainst += ta;
  if (tf > ta) s.won++;
  else if (tf === ta) s.draw++;
  else s.lost++;
}

function toTeamStats(s: S, teamId: number, teamName: string): TeamStats {
  return {
    teamId,
    teamName,
    ...s,
    goalDiff: s.goalsFor - s.goalsAgainst,
    avgGoalDiff: s.played > 0 ? Math.round(((s.goalsFor - s.goalsAgainst) / s.played) * 10) / 10 : 0,
  };
}

function buildStats(teams: TeamData[], matches: MatchData[]): StatsResponse {
  const perTeam: StatsResponse["perTeam"] = {};
  for (const team of teams) {
    const tm = matches.filter((m) => m.teamId === team.id);
    const ov = emptyS(), we = emptyS(), wo = emptyS();
    for (const m of tm) addResult(ov, m, team.name);
    for (const m of tm.filter((m) => m.emreInSquad)) addResult(we, m, team.name);
    for (const m of tm.filter((m) => !m.emreInSquad)) addResult(wo, m, team.name);
    perTeam[team.id] = {
      teamName: team.name,
      overall: toTeamStats(ov, team.id, team.name),
      withEmre: toTeamStats(we, team.id, "Med Emre"),
      withoutEmre: toTeamStats(wo, team.id, "Uten Emre"),
    };
  }

  const playedMatches = matches.filter((m) => m.isPlayed);
  const cov = emptyS(), cwe = emptyS(), cwo = emptyS();
  for (const m of playedMatches) {
    const team = teams.find((t) => t.id === m.teamId);
    if (!team) continue;
    addResult(cov, m, team.name);
    if (m.emreInSquad) addResult(cwe, m, team.name);
    else addResult(cwo, m, team.name);
  }

  const emreStats = matches.filter((m) => m.emreInSquad && m.emreStats).map((m) => m.emreStats!);
  const ep = emreStats.length;
  const avg = (n: number) => ep > 0 ? Math.round((n / ep) * 100) / 100 : 0;
  const sum = (fn: (e: typeof emreStats[0]) => number) => emreStats.reduce((s, e) => s + fn(e), 0);

  return {
    teams,
    perTeam,
    combined: {
      overall: toTeamStats(cov, 0, "Alle lag"),
      withEmre: toTeamStats(cwe, 0, "Med Emre"),
      withoutEmre: toTeamStats(cwo, 0, "Uten Emre"),
    },
    emre: {
      matchesPlayed: ep,
      totalGoals: sum((e) => e.goals),
      totalSevenMeter: sum((e) => e.sevenMeter),
      totalYellowCards: sum((e) => e.yellowCards),
      totalTwoMinutes: sum((e) => e.twoMinutes),
      totalRedCards: sum((e) => e.redCards),
      avgGoals: avg(sum((e) => e.goals)),
      avgSevenMeter: avg(sum((e) => e.sevenMeter)),
      avgYellowCards: avg(sum((e) => e.yellowCards)),
      avgTwoMinutes: avg(sum((e) => e.twoMinutes)),
    },
  };
}

export default function ClientApp({ initialMatches, teams, seasons }: Props) {
  const [tab, setTab] = useState<Tab>("kamper");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedSeason, setSelectedSeason] = useState<number>(seasons[0]?.id ?? 1);

  // All matches for the selected season
  const seasonMatches = useMemo(
    () => initialMatches.filter((m) => m.seasonId === selectedSeason),
    [initialMatches, selectedSeason]
  );

  // Teams that have at least one match in the selected season (preserving TEAM_ORDER sort)
  const seasonTeams = useMemo(
    () => teams.filter((t) => seasonMatches.some((m) => m.teamId === t.id)),
    [teams, seasonMatches]
  );

  const stats = useMemo(() => buildStats(seasonTeams, seasonMatches), [seasonTeams, seasonMatches]);

  const filteredMatches = useMemo(() => {
    const filtered = seasonMatches.filter((m) => {
      if (teamFilter !== "all" && String(m.teamId) !== teamFilter) return false;
      if (statusFilter === "played" && !m.isPlayed) return false;
      if (statusFilter === "upcoming" && m.isPlayed) return false;
      if (statusFilter === "participated" && !m.emreInSquad) return false;
      if (statusFilter === "not-participated" && m.emreInSquad) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "date_asc":  return (a.date ?? "").localeCompare(b.date ?? "");
        case "date_desc": return (b.date ?? "").localeCompare(a.date ?? "");
        case "goals_desc": return (b.emreStats?.goals ?? -1) - (a.emreStats?.goals ?? -1);
        case "margin_desc": {
          const ma = getMargin(a) ?? -Infinity;
          const mb = getMargin(b) ?? -Infinity;
          return mb - ma;
        }
        case "margin_asc": {
          const ma = getMargin(a) ?? Infinity;
          const mb = getMargin(b) ?? Infinity;
          return ma - mb;
        }
      }
    });
  }, [seasonMatches, teamFilter, statusFilter, sortKey]);

  const totalMatches = filteredMatches.length;
  const playedCount = filteredMatches.filter((m) => m.isPlayed).length;
  const emrePlayedCount = filteredMatches.filter((m) => m.isPlayed && m.emreInSquad).length;
  const emrePct = playedCount > 0 ? Math.round((emrePlayedCount / playedCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-sky-700 text-white sticky-header shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤾</span>
              <div>
                <h1 className="text-lg font-bold leading-tight">
                  Emre Askim Pettersen
                </h1>
              </div>
            </div>
            {seasons.length > 1 && (
              <select
                value={selectedSeason}
                onChange={(e) => {
                  setSelectedSeason(Number(e.target.value));
                  setTeamFilter("all");
                }}
                className="text-sm border border-sky-500 rounded-lg px-3 py-1.5 bg-sky-600 text-white focus:outline-none focus:ring-2 focus:ring-white"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0">
          {(["kamper", "statistikk"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                tab === t
                  ? "bg-gray-50 text-sky-700"
                  : "text-sky-100 hover:text-white hover:bg-sky-600"
              }`}
            >
              {t === "kamper" ? "Kamper" : "Statistikk"}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === "kamper" ? (
          <div className="space-y-4">
            {/* Filters + view toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MatchFilters
                teams={seasonTeams}
                selectedTeam={teamFilter}
                selectedStatus={statusFilter}
                sortKey={sortKey}
                onTeamChange={setTeamFilter}
                onStatusChange={setStatusFilter}
                onSortChange={(v) => setSortKey(v as SortKey)}
              />

              {/* View mode toggle (hidden on mobile – always cards) */}
              <div className="hidden sm:flex rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    viewMode === "table"
                      ? "bg-sky-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  ☰ Tabell
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    viewMode === "cards"
                      ? "bg-sky-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  ⊞ Kort
                </button>
              </div>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-600">
                {totalMatches} kamper
              </span>
              <span className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-600">
                {playedCount} spilt
              </span>
              <span className="text-xs bg-sky-50 border border-sky-200 px-3 py-1 rounded-full text-sky-700">
                Emre med i {emrePlayedCount} av {playedCount} spilte ({emrePct}%)
              </span>
            </div>

            {/* Match list */}
            {/* Mobile: always cards */}
            <div className="sm:hidden space-y-3">
              {filteredMatches.length === 0 ? (
                <p className="text-center text-gray-400 py-12">
                  Ingen kamper funnet
                </p>
              ) : (
                filteredMatches.map((m) => <MatchCard key={m.id} match={m} />)
              )}
            </div>

            {/* Desktop: table or cards */}
            <div className="hidden sm:block">
              {viewMode === "table" ? (
                <MatchTable matches={filteredMatches} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMatches.length === 0 ? (
                    <p className="text-center text-gray-400 py-12 col-span-2">
                      Ingen kamper funnet
                    </p>
                  ) : (
                    filteredMatches.map((m) => <MatchCard key={m.id} match={m} />)
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <StatsView stats={stats} matches={seasonMatches} />
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-6 mt-4 text-center text-xs text-gray-400">
        Data hentet fra handball.no · Oppdateres automatisk etter kamper
      </footer>
    </div>
  );
}
