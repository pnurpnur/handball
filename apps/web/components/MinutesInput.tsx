"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  matchId: string;
  initialMinutes: number | null;
  matchLength: number | null;
  onSaved?: (matchId: string, value: number | null) => void;
}

type SaveState = "idle" | "saving" | "error";

export default function MinutesInput({ matchId, initialMinutes, matchLength, onSaved }: Props) {
  const [minutes, setMinutes] = useState<number | null>(initialMinutes);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function save(value: number | null) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/matches/${matchId}/minutes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesPlayed: value }),
        keepalive: true,
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("idle");
      onSaved?.(matchId, value);
    } catch {
      setSaveState("error");
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<number | null>(initialMinutes);

  // Save shortly after typing stops (don't rely on blur, which mobile
  // browsers often skip before a refresh/navigation).
  function scheduleSave(value: number | null) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (value !== lastSaved.current) {
        lastSaved.current = value;
        save(value);
      }
    }, 500);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const value =
      raw === "" ? null : Number.isNaN(parseInt(raw, 10)) ? null : Math.max(0, parseInt(raw, 10));
    setMinutes(value);
    scheduleSave(value);
  }

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const pct =
    matchLength && minutes !== null ? Math.round((minutes / matchLength) * 100) : null;

  return (
    <div className="flex items-center gap-1.5" onClick={stop}>
      <input
        type="number"
        min={0}
        max={200}
        inputMode="numeric"
        value={minutes ?? ""}
        onChange={handleChange}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          if (minutes !== lastSaved.current) {
            lastSaved.current = minutes;
            save(minutes);
          }
        }}
        onClick={stop}
        placeholder="min"
        aria-label="Minutter spilt"
        className={`w-14 text-xs text-center border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
          saveState === "error" ? "border-red-400" : "border-gray-200"
        }`}
      />
      {pct !== null && <span className="text-xs text-gray-400 whitespace-nowrap">{pct}%</span>}
      {saveState === "saving" && <span className="text-xs text-gray-300">…</span>}
    </div>
  );
}
