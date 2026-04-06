"use client";

import { useState } from "react";
import type { MatchData, StatsResponse, TeamStats } from "@/lib/types";

interface Props {
  stats: StatsResponse;
  matches: MatchData[];
}

interface MatchSummary {
  id: string;
  date: string;
  teamGoals: number;
  oppGoals: number;
  opponent: string;
  teamLabel?: string; // shown in combined view
}

interface Breakdown {
  won: MatchSummary[];
  draw: MatchSummary[];
  lost: MatchSummary[];
}

/** Classify matches into won/draw/lost from the tracked team's perspective. */
function classifyMatches(
  matches: MatchData[],
  teamName: string | null // null = use each match's own teamName
): Breakdown {
  const won: MatchSummary[] = [], draw: MatchSummary[] = [], lost: MatchSummary[] = [];

  for (const m of matches) {
    if (!m.isPlayed || m.homeScore === null || m.awayScore === null) continue;
    const name = teamName ?? m.teamName;
    const firstWord = name.toLowerCase().split(" ")[0];
    const isHome = m.homeTeam.toLowerCase().includes(firstWord);
    const tf = isHome ? m.homeScore : m.awayScore;
    const ta = isHome ? m.awayScore : m.homeScore;
    const opponent = isHome ? m.awayTeam : m.homeTeam;
    const date = m.date
      ? new Date(m.date).toLocaleDateString("no-NO", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        })
      : "";
    const summary: MatchSummary = {
      id: m.id,
      date,
      teamGoals: tf,
      oppGoals: ta,
      opponent,
      teamLabel: teamName === null ? m.teamName : undefined,
    };
    if (tf > ta) won.push(summary);
    else if (tf === ta) draw.push(summary);
    else lost.push(summary);
  }

  return { won, draw, lost };
}

function MatchTooltip({ matches }: { matches: MatchSummary[] }) {
  if (matches.length === 0) return null;
  return (
    // pb-2 bridges the gap between the box and tooltip so hover stays active
    <div className="hidden group-hover:block absolute z-50 bottom-full pb-2 left-1/2 -translate-x-1/2">
      <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
        <div className="space-y-1">
          {matches.map((m) => (
            <a
              key={m.id}
              href={`https://www.handball.no/system/kamper/kamp/?matchid=${m.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-sky-300 transition-colors"
            >
              <span className="font-semibold">
                {m.teamGoals}–{m.oppGoals}
              </span>
              <span>mot {m.opponent}</span>
              {m.teamLabel && (
                <span className="opacity-60">· {m.teamLabel}</span>
              )}
              <span className="opacity-60">· {m.date}</span>
              <span className="opacity-40">↗</span>
            </a>
          ))}
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
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

function WithoutEmreToggle({
  isExpanded,
  onToggle,
  children,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="bg-gray-500 hover:bg-gray-600 transition-colors rounded-xl text-white text-xs font-semibold py-2 px-1.5 self-stretch flex items-center justify-center"
        title="Vis uten Emre"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        Uten Emre
      </button>
    );
  }
  return (
    <div className="flex-1 cursor-pointer" onClick={onToggle}>
      {children}
    </div>
  );
}

function TeamStatsBlock({
  stats,
  label,
  color,
  breakdown,
}: {
  stats: TeamStats;
  label: string;
  color: "blue" | "green" | "gray";
  breakdown: Breakdown;
}) {
  const colors = {
    blue: "bg-sky-600",
    green: "bg-emerald-600",
    gray: "bg-gray-500",
  };

  const winPct =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  const wdl = [
    { label: "Vunnet", value: stats.won, color: "text-green-700 bg-green-50", matches: breakdown.won },
    { label: "Uavgjort", value: stats.draw, color: "text-yellow-700 bg-yellow-50", matches: breakdown.draw },
    { label: "Tapt", value: stats.lost, color: "text-red-700 bg-red-50", matches: breakdown.lost },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className={`${colors[color]} px-4 py-2 rounded-t-xl`}>
        <p className="text-white text-sm font-semibold">{label}</p>
      </div>
      <div className="p-3 space-y-0.5">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {wdl.map(({ label, value, color, matches }) => (
            <div key={label} className="relative group">
              <div className={`rounded-lg p-2 text-center cursor-default ${color} ${matches.length > 0 ? "hover:opacity-80" : ""}`}>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs">{label}</p>
              </div>
              {matches.length > 0 && <MatchTooltip matches={matches} />}
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

export default function StatsView({ stats, matches }: Props) {
  const playedMatches = matches.filter((m) => m.isPlayed);
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
  const [expandedCombined, setExpandedCombined] = useState(false);

  const toggleTeam = (teamId: number) => {
    const newSet = new Set(expandedTeams);
    if (newSet.has(teamId)) {
      newSet.delete(teamId);
    } else {
      newSet.add(teamId);
    }
    setExpandedTeams(newSet);
  };

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
                sub: stats.combined.overall.played > 0
                  ? `${Math.round((stats.emre.matchesPlayed / stats.combined.overall.played) * 100)}% deltakelse`
                  : null,
                color: "bg-sky-50 text-sky-700",
              },
              {
                label: "Mål",
                total: stats.emre.totalGoals,
                sub: `${stats.emre.avgGoals} snitt`,
                color: "bg-emerald-50 text-emerald-700",
              },
              {
                label: "7M",
                total: stats.emre.totalSevenMeter,
                sub: `${stats.emre.avgSevenMeter} snitt`,
                color: "bg-blue-50 text-blue-700",
              },
              {
                label: "Gule",
                total: stats.emre.totalYellowCards,
                sub: `${stats.emre.avgYellowCards} snitt`,
                color: "bg-yellow-50 text-yellow-700",
              },
              {
                label: "2 min",
                total: stats.emre.totalTwoMinutes,
                sub: `${stats.emre.avgTwoMinutes} snitt`,
                color: "bg-orange-50 text-orange-700",
              },
            ].map(({ label, total, sub, color }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs font-medium">{label}</p>
                {sub !== null && (
                  <p className="text-xs opacity-70 mt-0.5">{sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Combined comparison: with vs without Emre */}
      <section>
        <h2 className="text-base font-bold text-gray-800 mb-3">
          📊 Alle lag
        </h2>
        <div className="flex gap-3 items-stretch">
          <div className="flex-1">
            <TeamStatsBlock
              stats={stats.combined.overall}
              label="Totalt"
              color="blue"
              breakdown={classifyMatches(playedMatches, null)}
            />
          </div>
          <div className="flex-1">
            <TeamStatsBlock
              stats={stats.combined.withEmre}
              label="Med Emre"
              color="green"
              breakdown={classifyMatches(playedMatches.filter((m) => m.emreInSquad), null)}
            />
          </div>
          <WithoutEmreToggle isExpanded={expandedCombined} onToggle={() => setExpandedCombined(!expandedCombined)}>
            <TeamStatsBlock
              stats={stats.combined.withoutEmre}
              label="Uten Emre"
              color="gray"
              breakdown={classifyMatches(playedMatches.filter((m) => !m.emreInSquad), null)}
            />
          </WithoutEmreToggle>
        </div>
      </section>

      {/* Per-team breakdown */}
      {stats.teams.map((team) => {
        const teamStats = stats.perTeam[team.id];
        if (!teamStats) return null;
        const teamMatches = playedMatches.filter((m) => m.teamId === team.id);
        const isExpanded = expandedTeams.has(team.id);

        return (
          <section key={team.id}>
            <h2 className="text-base font-bold text-gray-800 mb-3">
              🤾 {team.name}
            </h2>
            <div className="flex gap-3 items-stretch">
              <div className="flex-1">
                <TeamStatsBlock
                  stats={teamStats.overall}
                  label="Totalt"
                  color="blue"
                  breakdown={classifyMatches(teamMatches, teamStats.teamName)}
                />
              </div>
              <div className="flex-1">
                <TeamStatsBlock
                  stats={teamStats.withEmre}
                  label="Med Emre"
                  color="green"
                  breakdown={classifyMatches(teamMatches.filter((m) => m.emreInSquad), teamStats.teamName)}
                />
              </div>
              <WithoutEmreToggle isExpanded={isExpanded} onToggle={() => toggleTeam(team.id)}>
                <TeamStatsBlock
                  stats={teamStats.withoutEmre}
                  label="Uten Emre"
                  color="gray"
                  breakdown={classifyMatches(teamMatches.filter((m) => !m.emreInSquad), teamStats.teamName)}
                />
              </WithoutEmreToggle>
            </div>
          </section>
        );
      })}
    </div>
  );
}
