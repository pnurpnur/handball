"use client";

import type { TeamData } from "@/lib/types";

interface Props {
  teams: TeamData[];
  selectedTeam: string;
  selectedStatus: string;
  sortKey: string;
  onTeamChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSortChange: (v: string) => void;
}

export default function MatchFilters({
  teams,
  selectedTeam,
  selectedStatus,
  sortKey,
  onTeamChange,
  onStatusChange,
  onSortChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Team filter */}
      <select
        value={selectedTeam}
        onChange={(e) => onTeamChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent min-w-[160px]"
      >
        <option value="all">Alle lag</option>
        {teams.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.name}
          </option>
        ))}
      </select>

      {/* Sort */}
      <select
        value={sortKey}
        onChange={(e) => onSortChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      >
        <option value="date_desc">Dato ↓</option>
        <option value="date_asc">Dato ↑</option>
        <option value="goals_desc">Emre mål ↓</option>
        <option value="margin_desc">Seiersmargin ↓</option>
        <option value="margin_asc">Seiersmargin ↑</option>
      </select>

      {/* Status filter */}
      <div className="flex rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {[
          { value: "all", label: "Alle" },
          { value: "played", label: "Spilt" },
          { value: "upcoming", label: "Ikke spilt" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onStatusChange(value)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              selectedStatus === value
                ? "bg-sky-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
