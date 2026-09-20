"use client";

import type { MatchData } from "@/lib/types";

interface Props {
  match: MatchData;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Dato ukjent";
  const d = new Date(iso);
  return d.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hours = d.getHours();
  const mins = d.getMinutes();
  if (hours === 12 && mins === 0) return ""; // Default placeholder time
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

function ResultBadge({ match }: { match: MatchData }) {
  if (!match.isPlayed || match.homeScore === null || match.awayScore === null) {
    return (
      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
        Ikke spilt
      </span>
    );
  }

  const teamName = match.teamName.toLowerCase();
  const homeIsTeam = match.homeTeam.toLowerCase().includes(teamName.split(" ")[0]);
  const teamScore = homeIsTeam ? match.homeScore : match.awayScore;
  const oppScore = homeIsTeam ? match.awayScore : match.homeScore;

  const result = teamScore > oppScore ? "V" : teamScore === oppScore ? "U" : "T";
  const colors = {
    V: "bg-green-100 text-green-800",
    U: "bg-yellow-100 text-yellow-800",
    T: "bg-red-100 text-red-800",
  };

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colors[result]}`}>
      {result}
    </span>
  );
}

export default function MatchCard({ match }: Props) {
  const time = formatTime(match.date);
  const hnUrl = `https://www.handball.no/system/kamper/kamp/?matchid=${match.id}`;

  return (
    <a
      href={hnUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-match-id={match.id}
      className="block bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3 hover:border-sky-200 hover:shadow-md transition-all"
    >
      {/* Header: date + team + tournament */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400">
            {formatDate(match.date)}
            {time && <span> · {time}</span>}
          </p>
          <p className="text-xs text-sky-600 font-medium mt-0.5">{match.tournament}</p>
        </div>
        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
          {match.teamName}
        </span>
      </div>

      {/* Match */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{match.homeTeam}</p>
          <p className="font-semibold text-sm truncate">{match.awayTeam}</p>
        </div>

        <div className="text-center mx-2">
          {match.isPlayed && match.homeScore !== null ? (
            <div className="text-lg font-bold tabular-nums">
              <span>{match.homeScore}</span>
              <span className="text-gray-400 mx-1">–</span>
              <span>{match.awayScore}</span>
            </div>
          ) : (
            <div className="text-sm text-gray-400 font-medium">vs</div>
          )}
          <ResultBadge match={match} />
        </div>
      </div>

      {/* Emre */}
      {match.emreInSquad && (
        <div className="border-t border-gray-50 pt-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-600 shrink-0">⚡ Emre</span>
          {match.emreStats ? (
            <>
              <div className="flex flex-col items-center rounded-lg bg-emerald-50 px-2.5 py-1 leading-tight">
                <span className="text-sm font-bold text-emerald-700">
                  {match.emreStats.goals + match.emreStats.sevenMeter}
                  {match.emreStats.sevenMeter > 0 && (
                    <span className="text-xs font-medium text-emerald-500">
                      {" "}
                      ({match.emreStats.sevenMeter})
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600/70 tracking-wide">
                  MÅL
                </span>
              </div>
              {match.emreStats.minutesPlayed !== null && (
                <div className="flex flex-col items-center rounded-lg bg-indigo-50 px-2.5 py-1 leading-tight">
                  <span className="text-sm font-bold text-indigo-700">
                    {match.emreStats.minutesPlayed}
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-600/70 tracking-wide">
                    MIN
                  </span>
                </div>
              )}
              {(match.emreStats.yellowCards > 0 ||
                match.emreStats.twoMinutes > 0 ||
                match.emreStats.redCards > 0) && (
                <span className="flex items-center gap-0.5 text-sm">
                  {Array.from({ length: match.emreStats.yellowCards }).map((_, i) => (
                    <span key={`yellow-${i}`} title="Gult kort">
                      🟨
                    </span>
                  ))}
                  {Array.from({ length: match.emreStats.twoMinutes }).map((_, i) => (
                    <span key={`two-${i}`} title="2 minutter">
                      ✌️
                    </span>
                  ))}
                  {Array.from({ length: match.emreStats.redCards }).map((_, i) => (
                    <span key={`red-${i}`} title="Rødt kort">
                      🟥
                    </span>
                  ))}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400">I troppen</span>
          )}
        </div>
      )}
    </a>
  );
}
