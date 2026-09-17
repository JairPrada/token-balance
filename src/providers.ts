/**
 * Provider key resolution and API fetchers.
 *
 * Key resolution follows a 4-tier priority:
 *   1. Environment variable
 *   2. opencode.json provider config (supports {env:VAR} references)
 *   3. token-balance/config.json (from /tb-setup wizard)
 *   4. auth.json (opencode's built-in auth)
 */

import {
  type AuthEntry,
  type PluginConfig,
  readAuth,
  readPluginConfig,
  readOpencodeConfig,
} from "./config.js";
import { formatTime } from "./helpers.js";

// ─── Key Resolution ──────────────────────────────────────────────────────

export function resolveKey(
  auth: Record<string, AuthEntry> | undefined,
  providerId: string,
  envVar: string,
  fallbackIds?: string[],
): string | undefined {
  // Tier 1: environment variable
  const envVal = process.env[envVar];
  if (envVal) return envVal;

  // Tier 2: opencode.json / opencode.jsonc
  const oc = readOpencodeConfig();
  const pCfg = oc?.provider?.[providerId] ?? oc?.providers?.[providerId];
  if (pCfg) {
    let k = pCfg.apiKey ?? pCfg.options?.apiKey;
    if (k) {
      const envMatch = k.match(/^\{env:\s*(\w+)\s*\}$/);
      if (envMatch) k = process.env[envMatch[1]];
      if (k) return k;
    }
  }

  // Tier 3: token-balance/config.json (from setup wizard)
  const cfg = readPluginConfig();
  const cfgKey = cfg.apiKeys?.[providerId as keyof typeof cfg.apiKeys];
  if (cfgKey) return cfgKey;

  // Tier 4: auth.json
  if (auth?.[providerId]?.key) return auth[providerId].key;
  for (const fid of fallbackIds ?? []) {
    if (auth?.[fid]?.key) return auth[fid].key;
  }

  return undefined;
}

// ─── DeepSeek ────────────────────────────────────────────────────────────

export interface DS {
  value: string;
  pct: number;
}

export async function fetchDS(max: number): Promise<DS> {
  const auth = readAuth();
  const key = resolveKey(auth, "deepseek", "DEEPSEEK_API_KEY");
  if (!key) return { value: "sin API key", pct: -1 };

  try {
    const r = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "token-balance/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { value: `error ${r.status}`, pct: -1 };

    const d = (await r.json()) as Record<string, unknown>;
    const infos = Array.isArray(d.balance_infos) ? d.balance_infos : [];
    const usd = infos.find((i: any) => i.currency === "USD") ?? infos[0];

    if (usd?.total_balance) {
      const bal = parseFloat(usd.total_balance);
      return {
        value: `USD ${bal.toFixed(2)}`,
        pct: max > 0 ? Math.round((bal / max) * 100) : -1,
      };
    }
    return { value: "sin datos", pct: -1 };
  } catch {
    return { value: "error de conexion", pct: -1 };
  }
}

// ─── OpenCode Go ─────────────────────────────────────────────────────────

export interface GoLine {
  label: string;
  time: string;
  pct: number;
}

export async function fetchGo(): Promise<GoLine[]> {
  const auth = readAuth();
  const key = resolveKey(auth, "opencode-go", "OPENCODE_API_KEY", ["opencode"]);
  if (!key) return [{ label: "", time: "sin API key", pct: 0 }];

  try {
    const r = await fetch("https://opencode.ai/zen/go/v1/usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [{ label: "", time: `error ${r.status}`, pct: 0 }];

    const d = (await r.json()) as Record<string, unknown>;
    const u = d?.usage as Record<string, unknown> | undefined;
    if (!u) return [{ label: "", time: "sin datos", pct: 0 }];

    const lines: GoLine[] = [];
    for (const w of [
      { key: "rolling", label: "Five-hour" },
      { key: "weekly", label: "Weekly" },
      { key: "monthly", label: "Monthly" },
    ]) {
      const win = u[w.key] as Record<string, unknown> | undefined;
      if (!win || win.status !== "ok") continue;

      const used = typeof win.percent === "number" ? win.percent : 0;
      const rem = 100 - used;
      const resetsAt = typeof win.resetsAt === "string" ? win.resetsAt : "";
      const ms = resetsAt ? Math.max(0, Date.parse(resetsAt) - Date.now()) : 0;

      lines.push({ label: w.label, time: formatTime(ms), pct: rem });
    }

    return lines.length > 0 ? lines : [{ label: "", time: "sin datos", pct: 0 }];
  } catch {
    return [{ label: "", time: "error de conexion", pct: 0 }];
  }
}

// ─── OpenCode Zen ────────────────────────────────────────────────────────

export async function fetchZen(): Promise<boolean> {
  const cfg = readPluginConfig();
  const ws = cfg.zen?.workspaceId?.trim() ?? "";
  const cookie = cfg.zen?.authCookie?.trim() ?? "";
  if (!ws || !cookie) return false;

  try {
    const r = await fetch(
      `https://opencode.ai/workspace/${encodeURIComponent(ws)}/billing`,
      {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0",
          Accept: "text/html",
          Cookie: `auth=${cookie}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    return r.ok;
  } catch {
    return false;
  }
}
