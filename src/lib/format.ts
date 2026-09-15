/**
 * Display formatting utilities.
 */

/** Clamp a number to an integer within [min, max]. */
export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** Render a progress bar of filled/empty blocks. */
export function bar(percentRemaining: number, width: number): string {
  const p = clampInt(percentRemaining, 0, 100);
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

/** Pad string to width on the right. */
export function padRight(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width);
  return str + " ".repeat(width - str.length);
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Format a reset countdown like "2d 5h" or "3h 45m".
 * Returns "reset" if the time is in the past.
 */
export function formatResetCountdown(iso: string | null | undefined, opts?: { compactRounded?: boolean }): string {
  if (!iso) return "";
  const resetDate = new Date(iso);
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "reset";

  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / 1440);
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const minutes = diffMinutes % 60;

  if (opts?.compactRounded) {
    if (days > 0) return `${days}d`;
    const halfHours = Math.ceil(diffMinutes / 30);
    const h = Math.floor(halfHours / 2);
    if (h > 0) return halfHours % 2 === 1 ? `${h}.5h` : `${h}h`;
    return "0.5h";
  }

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Format a percentage label like "94% left". */
export function formatPercentLabel(percentRemaining: number, mode: "remaining" | "used" = "remaining"): string {
  const remaining = Math.max(0, Math.round(percentRemaining));
  const used = Math.max(0, Math.round(100 - percentRemaining));
  const value = mode === "used" ? used : remaining;
  return `${value}% ${mode === "used" ? "used" : "left"}`;
}
