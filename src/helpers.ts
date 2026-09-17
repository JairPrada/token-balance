/**
 * UI helper functions for rendering bars, padding, and formatting.
 */

import fs from "node:fs";

const BAR = 26;
const BAR_LABEL_W = 35 - BAR - 1;

export function pctColor(pct: number): string {
  if (pct >= 60) return "#98c379";
  if (pct >= 30) return "#f1fa8c";
  return "#ff5555";
}

export function makeBar(pct: number): { text: string; color: string } {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round((p / 100) * BAR);
  return {
    text: "\u2588".repeat(filled) + "\u2591".repeat(BAR - filled),
    color: pctColor(p),
  };
}

export function rpad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return s + " ".repeat(w - s.length);
}

export function lpad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return " ".repeat(w - s.length) + s;
}

export function formatTime(ms: number): string {
  if (ms <= 0) return "ahora";
  const mins = Math.ceil(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs >= 24) {
    const d = Math.floor(hrs / 24);
    const rh = hrs % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  return hrs >= 1 ? `${hrs}h` : `${mins % 60}m`;
}

export function safeJson<T>(f: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as T;
  } catch (e: unknown) {
    if (fs.existsSync(f)) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[token-balance] malformed JSON in ${f}: ${msg}\n`);
    }
    return undefined;
  }
}

export { BAR, BAR_LABEL_W };
