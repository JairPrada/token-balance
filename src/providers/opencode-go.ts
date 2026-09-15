/**
 * OpenCode Go quota provider.
 *
 * GET https://opencode.ai/zen/go/v1/usage
 */

import { resolveOpenCodeGoKey } from "../auth/opencode-go.js";
import { fetchWithTimeout } from "../lib/http.js";

const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";

export interface WindowUsage {
  status: string;
  usagePercent: number;
  percentRemaining: number;
  resetTimeIso: string;
}

export interface OpenCodeGoResult {
  available: boolean;
  rolling?: WindowUsage;
  weekly?: WindowUsage;
  monthly?: WindowUsage;
  error?: string;
}

function parseWindow(value: unknown): WindowUsage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const w = value as Record<string, unknown>;
  if (w.status !== "ok") return undefined;
  const percent = typeof w.percent === "number" ? w.percent : NaN;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return undefined;
  const resetsAt = typeof w.resetsAt === "string" ? w.resetsAt : "";
  if (!resetsAt) return undefined;
  const resetTime = Date.parse(resetsAt);
  if (!Number.isFinite(resetTime)) return undefined;

  return {
    status: "ok",
    usagePercent: percent,
    percentRemaining: 100 - percent,
    resetTimeIso: new Date(resetTime).toISOString(),
  };
}

export async function fetchOpenCodeGoQuota(): Promise<OpenCodeGoResult> {
  const key = await resolveOpenCodeGoKey();
  if (!key) {
    return { available: false, error: "No API key configured" };
  }

  try {
    return await fetchWithTimeout(OPENCODE_GO_USAGE_URL, {
      request: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
      consume: async (response) => {
        if (!response.ok) {
          return { available: false, error: `API error ${response.status}` };
        }
        const payload = await response.json() as Record<string, unknown>;
        const usage = typeof payload.usage === "object" && payload.usage !== null
          ? payload.usage as Record<string, unknown>
          : null;

        if (!usage) {
          return { available: false, error: "Invalid response: missing usage" };
        }

        const rolling = parseWindow(usage.rolling);
        const weekly = parseWindow(usage.weekly);
        const monthly = parseWindow(usage.monthly);

        return {
          available: Boolean(rolling || weekly || monthly),
          rolling,
          weekly,
          monthly,
        };
      },
    });
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
