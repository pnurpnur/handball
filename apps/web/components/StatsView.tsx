"use client";

import type { StatsResponse, TeamStats } from "@/lib/types";

interface Props {
  stats: StatsResponse;
}

function StatRow({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center py-2 px-3 rounded-lg ${
        highlight ? "bg-sky-50" : ""
      }`}
    >
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
        {sub && <span className="text-xs text-gray-400 ml-1">({sub})</span>}
      </div>
    </div>
  );
}

function TeamStatsBlock({
  stats,
  label,
  color,
}: {
  stats: TeamStats;
  label: string;
  color: "blue" | "green" | "gray";
}) {
  const colors = {
    blue: "bg-sky-600",
    green: "bg-emerald-600",
    gray: "bg-gray-500",
  };

  const winPct =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`${colors[color]} px-4 py-2`}>
        <p className="text-white text-sm font-semibold">{label}</p>
      </div>
      <div className="p-3 space-y-0.5">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Vunnet", value: stats.won, color: "text-green-700 bg-green-50" },
            { label: "Uavgjort", value: stats.draw, color: "text-yellow-700 bg-yellow-50" },
            { label: "Tapt", value: stats.lost, color: "text-red-700 bg-red-50" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-lg p-2 text-center ${color}`}>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs">{label}</p>
            </div>
          ))}
        </div>
        <StatRow label="Kamper" value={stats.played} />
        <StatRow label="Seiersprosent" value={`${winPct}%`} highlight />
        <StatRow
          label="Mål"
          value={`${stats.goalsFor}–${stats.goalsAgainst}`}
        />
        <StatRow
          label="Målforskjell"
          value={stats.goalDiff >= 0 ? `+${stats.goalDiff}` : stats.goalDiff}
          sub={`snitt ${stats.avgGoalDiff >= 0 ? "+" : ""}${stats.avgGoalDiff}`}
        />
      </div>
    </div>
  );
}

export default function StatsView({ stats }: Props) {
  return (
    <div className="space-y-6">
      {/* Emre personal stats */}
      <section>
        <h2 className="text-base font-bold text-gray-800 mb-3">
          ⚡ Emres statistikk
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              {
                label: "Kamper",
                total: stats.emre.matchesPlayed,
                avg: null,
                color: "bg-sky-50 text-sky-700",
              },
              {
                label: "Mål",
                total: stats.emre.totalGoals,
                avg: stats.emre.avgGoals,
                color: "bg-emerald-50 text-emerald-700",
              },
              {
                label: "7M",
                total: stats.emre.totalSevenMeter,
                avg: stats.emre.avgSevenMeter,
                color: "bg-blue-50 text-blue-700",
              },
              {
                label: "Gule",
                total: stats.emre.totalYellowCards,
                avg: stats.emre.avgYellowCards,
                color: "bg-yellow-50 text-yellow-700",
              },
              {
                label: "2 min",
                total: stats.emre.totalTwoMinutes,
                avg: stats.emre.avgTwoMinutes,
                color: "bg-orange-50 text-orange-700",
              },
            ].map(({ label, total, avg, color }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs font-medium">{label}</p>
                {avg !== null && (
                  <p className="text-xs opacity-70 mt-0.5">{avg} snitt</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Combined comparison: with vs without Emre */}
      <section>
        <h2 className="text-base font-bold text-gray-800 mb-3">
          📊 Med vs. uten Emre – alle lag
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TeamStatsBlock
            stats={stats.combined.withEmre}
            label="Med Emre"
            color="green"
          />
          <TeamStatsBlock
            stats={stats.combined.withoutEmre}
            label="Uten Emre"
            color="gray"
          />
        </div>
      </section>

      {/* Per-team breakdown */}
      {stats.teams.map((team) => {
        const teamStats = stats.perTeam[team.id];
        if (!teamStats) return null;

        return (
          <section key={team.id}>
            <h2 className="text-base font-bold text-gray-800 mb-3">
              🤾 {team.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TeamStatsBlock
                stats={teamStats.overall}
                label="Totalt"
                color="blue"
              />
              <TeamStatsBlock
                stats={teamStats.withEmre}
                label="Med Emre"
                color="green"
              />
              <TeamStatsBlock
                stats={teamStats.withoutEmre}
                label="Uten Emre"
                color="gray"
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
