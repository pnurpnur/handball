"use client";

import type { MatchData } from "@/lib/types";

interface Props {
  matches: MatchData[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function Result({ match }: { match: MatchData }) {
  if (!match.isPlayed || match.homeScore === null || match.awayScore === null) {
    return <span className="text-gray-400 text-sm">–</span>;
  }

  return (
    <span className="font-mono text-sm">
      {match.homeScore}–{match.awayScore}
    </span>
  );
}

function WinIndicator({ match }: { match: MatchData }) {
  if (!match.isPlayed || match.homeScore === null || match.awayScore === null) {
    return null;
  }

  const teamName = match.teamName.toLowerCase();
  const homeIsTeam = match.homeTeam.toLowerCase().includes(teamName.split(" ")[0]);
  const teamScore = homeIsTeam ? match.homeScore : match.awayScore;
  const oppScore = homeIsTeam ? match.awayScore : match.homeScore;

  if (teamScore > oppScore)
    return <span className="text-green-600 font-semibold text-xs">V</span>;
  if (teamScore === oppScore)
    return <span className="text-yellow-600 font-semibold text-xs">U</span>;
  return <span className="text-red-600 font-semibold text-xs">T</span>;
}

export default function MatchTable({ matches }: Props) {
  return (
    <div className="table-scroll rounded-xl border border-gray-100 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap">
              Dato
            </th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs">
              Lag
            </th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs hidden sm:table-cell">
              Turnering
            </th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs">
              Kamp
            </th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-500 text-xs">
              Res
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              V/U/T
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              Emre
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              M
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              7M
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              A
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              2
            </th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs">
              D
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {matches.length === 0 && (
            <tr>
              <td colSpan={12} className="text-center py-10 text-gray-400">
                Ingen kamper funnet
              </td>
            </tr>
          )}
          {matches.map((match) => (
            <tr
              key={match.id}
              className="hover:bg-sky-50/30 transition-colors"
            >
              <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                {formatDate(match.date)}
              </td>
              <td className="px-3 py-2.5">
                <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {match.teamName}
                </span>
              </td>
              <td className="px-3 py-2.5 text-gray-500 text-xs hidden sm:table-cell max-w-[160px]">
                <span className="truncate block">{match.tournament}</span>
              </td>
              <td className="px-3 py-2.5 max-w-[180px]">
                <span className="text-xs font-medium block truncate">
                  {match.homeTeam}
                </span>
                <span className="text-xs text-gray-500 block truncate">
                  {match.awayTeam}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center">
                <Result match={match} />
              </td>
              <td className="px-2 py-2.5 text-center">
                <WinIndicator match={match} />
              </td>
              <td className="px-2 py-2.5 text-center">
                {match.emreInSquad ? (
                  <span className="text-green-500 text-base">✓</span>
                ) : (
                  <span className="text-gray-300 text-base">–</span>
                )}
              </td>
              <td className="px-2 py-2.5 text-center text-sm font-medium">
                {match.emreStats?.goals ?? (match.emreInSquad ? "0" : "–")}
              </td>
              <td className="px-2 py-2.5 text-center text-sm">
                {match.emreStats?.sevenMeter ?? (match.emreInSquad ? "0" : "–")}
              </td>
              <td className="px-2 py-2.5 text-center text-sm">
                {match.emreStats?.yellowCards ? (
                  <span className="text-yellow-600 font-semibold">
                    {match.emreStats.yellowCards}
                  </span>
                ) : (
                  match.emreInSquad ? "0" : "–"
                )}
              </td>
              <td className="px-2 py-2.5 text-center text-sm">
                {match.emreStats?.twoMinutes ? (
                  <span className="text-orange-600 font-semibold">
                    {match.emreStats.twoMinutes}
                  </span>
                ) : (
                  match.emreInSquad ? "0" : "–"
                )}
              </td>
              <td className="px-2 py-2.5 text-center text-sm">
                {match.emreStats?.redCards ? (
                  <span className="text-red-600 font-bold">
                    {match.emreStats.redCards}
                  </span>
                ) : (
                  match.emreInSquad ? "0" : "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
