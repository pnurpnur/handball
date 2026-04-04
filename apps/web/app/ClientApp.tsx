"use client";

import { useState, useMemo } from "react";
import type { MatchData, StatsResponse, TeamData } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import MatchTable from "@/components/MatchTable";
import MatchFilters from "@/components/MatchFilters";
import StatsView from "@/components/StatsView";

interface Props {
  initialMatches: MatchData[];
  initialStats: StatsResponse;
  teams: TeamData[];
}

type Tab = "kamper" | "statistikk";
type ViewMode = "table" | "cards";

export default function ClientApp({ initialMatches, initialStats, teams }: Props) {
  const [tab, setTab] = useState<Tab>("kamper");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const filteredMatches = useMemo(() => {
    return initialMatches.filter((m) => {
      if (teamFilter !== "all" && String(m.teamId) !== teamFilter) return false;
      if (statusFilter === "played" && !m.isPlayed) return false;
      if (statusFilter === "upcoming" && m.isPlayed) return false;
      return true;
    });
  }, [initialMatches, teamFilter, statusFilter]);

  const totalMatches = filteredMatches.length;
  const playedCount = filteredMatches.filter((m) => m.isPlayed).length;
  const emrePlayedCount = filteredMatches.filter((m) => m.isPlayed && m.emreInSquad).length;
  const emrePct = playedCount > 0 ? Math.round((emrePlayedCount / playedCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-sky-700 text-white sticky-header shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤾</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Emre Askim Pettersen
              </h1>
            </div>
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
                teams={teams}
                selectedTeam={teamFilter}
                selectedStatus={statusFilter}
                onTeamChange={setTeamFilter}
                onStatusChange={setStatusFilter}
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
          <StatsView stats={initialStats} />
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-6 mt-4 text-center text-xs text-gray-400">
        Data hentet fra handball.no · Oppdateres automatisk etter kamper
      </footer>
    </div>
  );
}
