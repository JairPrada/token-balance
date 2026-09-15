/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot, createSignal, onCleanup } from "solid-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const id = "@openplugins/token-balance";
const BAR_W = 26;
const SIDE_W = 36;
const REFRESH_INTERVAL_MS = 60_000;

// ─── Auth helpers (sync, same pattern as zen-free-panel.tsx) ───────────

function readAuthFile(): Record<string, { type?: string; key?: string }> | undefined {
  try {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".local", "share", "opencode", "auth.json"),
      path.join(home, "AppData", "Roaming", "opencode", "auth.json"),
      path.join(home, "AppData", "Local", "opencode", "auth.json"),
    ];
    for (const file of candidates) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch { /* try next */ }
    }
  } catch { /* ignore */ }
  return undefined;
}

function readZenConfig(): { workspaceId: string; authCookie: string } | undefined {
  try {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".config", "opencode", "opencode-quota", "opencode.json"),
      path.join(home, "AppData", "Roaming", "opencode", "opencode-quota", "opencode.json"),
      path.join(home, "AppData", "Local", "opencode", "opencode-quota", "opencode.json"),
    ];
    for (const file of candidates) {
      try {
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        const workspaceId = typeof config?.workspaceId === "string" ? config.workspaceId.trim() : "";
        const authCookie = typeof config?.authCookie === "string" ? config.authCookie.trim() : "";
        if (workspaceId && authCookie) return { workspaceId, authCookie };
      } catch { /* try next */ }
    }
  } catch { /* ignore */ }
  return undefined;
}

// ─── Provider fetchers ────────────────────────────────────────────────

async function fetchDeepSeek(): Promise<{ text: string; subtext: string }> {
  const auth = readAuthFile();
  const key = auth?.deepseek?.key;
  if (!key) return { text: "sin API key", subtext: "" };

  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "token-balance/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { text: `error ${res.status}`, subtext: "" };
    const data = await res.json() as Record<string, unknown>;
    const infos = Array.isArray(data.balance_infos) ? data.balance_infos : [];
    const usd = infos.find((i: any) => i.currency === "USD") ?? infos[0];
    if (usd?.total_balance) {
      return { text: `Total balance               USD ${parseFloat(usd.total_balance).toFixed(2)}`, subtext: "" };
    }
    return { text: "sin datos", subtext: "" };
  } catch { return { text: "error de conexion", subtext: "" }; }
}

async function fetchOpenCodeGo(): Promise<string[]> {
  const auth = readAuthFile();
  const key = auth?.["opencode-go"]?.key ?? auth?.opencode?.key;
  if (!key) return ["sin API key"];

  try {
    const res = await fetch("https://opencode.ai/zen/go/v1/usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [`error ${res.status}`];
    const data = await res.json() as Record<string, unknown>;
    const usage = data?.usage as Record<string, unknown> | undefined;
    if (!usage) return ["sin datos"];

    const lines: string[] = [];
    const windows = [
      { key: "rolling", label: "Five-hour" },
      { key: "weekly", label: "Weekly" },
      { key: "monthly", label: "Monthly" },
    ];
    for (const w of windows) {
      const win = usage[w.key] as Record<string, unknown> | undefined;
      if (!win || win.status !== "ok") continue;
      const percent = typeof win.percent === "number" ? win.percent : 0;
      const remaining = 100 - percent;
      const resetsAt = typeof win.resetsAt === "string" ? win.resetsAt : "";
      const resetMs = resetsAt ? Math.max(0, Date.parse(resetsAt) - Date.now()) : 0;
      const rem = formatCompact(resetMs);
      const filled = Math.round((remaining / 100) * BAR_W);
      const barStr = "\u2588".repeat(filled) + "\u2591".repeat(BAR_W - filled);
      lines.push(`${w.label.padEnd(27)}${rem}`);
      lines.push(`${barStr}   ${Math.round(remaining)}% left`);
    }
    return lines.length > 0 ? lines : ["sin datos"];
  } catch { return ["error de conexion"]; }
}

async function fetchOpenCodeZen(): Promise<{ text: string; barFill: number; color: string }> {
  const config = readZenConfig();
  if (!config) return { text: "sin config", barFill: 0, color: "#808080" };

  try {
    const url = `https://opencode.ai/workspace/${encodeURIComponent(config.workspaceId)}/billing`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0",
        Accept: "text/html",
        Cookie: `auth=${config.authCookie}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { text: `error ${res.status}`, barFill: 0, color: "#808080" };
    const html = await res.text();

    // Parse billing data from HTML
    const BILLING_UNITS = 100_000_000;
    let balance = 0;
    let monthlyLimit: number | null = null;
    let monthlyUsage: number | null = null;

    // Try SSR pattern
    const ssrRe = /\b(balance|monthlyLimit|monthlyUsage)\s*:\s*(\d+(?:\.\d+)?)\b/g;
    const fields: Record<string, number> = {};
    for (const m of html.matchAll(ssrRe)) fields[m[1]] = Number(m[2]);
    if (Number.isFinite(fields.balance) && fields.balance >= 0) {
      balance = fields.balance / BILLING_UNITS;
      monthlyLimit = Number.isFinite(fields.monthlyLimit) && fields.monthlyLimit >= 0 ? fields.monthlyLimit : null;
      monthlyUsage = Number.isFinite(fields.monthlyUsage) && fields.monthlyUsage >= 0 ? fields.monthlyUsage / BILLING_UNITS : null;
    }

    if (balance <= 0) return { text: "sin datos", barFill: 0, color: "#808080" };

    if (monthlyLimit !== null && monthlyUsage !== null && monthlyLimit > 0) {
      const remaining = Math.max(0, monthlyLimit - monthlyUsage);
      const pct = Math.round((remaining / monthlyLimit) * 100);
      const filled = Math.round((pct / 100) * BAR_W);
      const color = pct >= 60 ? "#50fa7b" : pct >= 30 ? "#f1fa8c" : "#ff5555";
      return { text: `Balance                USD ${balance.toFixed(2)}`, barFill: filled, color };
    }
    return { text: `Balance                USD ${balance.toFixed(2)}`, barFill: 0, color: "#808080" };
  } catch { return { text: "error de conexion", barFill: 0, color: "#808080" }; }
}

async function fetchZenFree(): Promise<string> {
  const auth = readAuthFile();
  const key = auth?.opencode?.key;
  if (!key) return "sin API key";

  const models = [
    "big-pickle", "deepseek-v4-flash-free", "muse-spark-1.3-contributor-free",
    "muse-spark-1.2-contributor-free", "mimo-v2.5-free", "ling-3.0-flash-fin-free",
    "nemotron-3-ultra-free", "nemotron-3.5-lightning-free",
  ];

  try {
    const results = await Promise.all(models.map(async (model) => {
      try {
        const res = await fetch("https://opencode.ai/zen/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "." }], max_tokens: 1 }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.status === 200) return "ok";
        if (res.status === 400) {
          const body = await res.text();
          if (body.includes("MissingSessionID")) return "ok";
        }
        return "error";
      } catch { return "error"; }
    }));
    const okCount = results.filter((r) => r === "ok").length;
    if (okCount > 0) return `Disponibles                    ahora`;
    return "sin modelos disponibles";
  } catch { return "error de conexion"; }
}

// ─── Formatting helpers ───────────────────────────────────────────────

function formatCompact(ms: number): string {
  if (ms <= 0) return "ahora";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours >= 1 ? `${hours}h` : `${minutes}m`;
}

// ─── TUI Plugin ───────────────────────────────────────────────────────

const tui: TuiPlugin = async (api: TuiPluginApi) => {
  const dispose = createRoot((disposeRoot) => {
    const [dsData, setDsData] = createSignal({ text: "consultando...", subtext: "" });
    const [goData, setGoData] = createSignal(["consultando..."]);
    const [zenData, setZenData] = createSignal({ text: "consultando...", barFill: 0, color: api.theme.current.textMuted });
    const [freeData, setFreeData] = createSignal("consultando...");
    let disposed = false;

    const refresh = async () => {
      if (disposed) return;

      // Fetch all providers in parallel
      const [ds, go, zen, free] = await Promise.all([
        fetchDeepSeek(),
        fetchOpenCodeGo(),
        fetchOpenCodeZen(),
        fetchZenFree(),
      ]);

      if (disposed) return;
      setDsData(ds);
      setGoData(go);
      setZenData(zen);
      setFreeData(free);
    };

    void refresh();
    const ticker = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    api.slots.register({
      order: 151,
      slots: {
        sidebar_content() {
          const ds = dsData();
          const go = goData();
          const zen = zenData();
          const free = freeData();

          const zenInfo = zen.barFill > 0
            ? zen.text
            : zen.text;

          return (
            <box gap={0}>
              {/* DeepSeek */}
              <text fg={api.theme.current.textMuted} wrapMode="none">
                {"\uD83D\uDC33 DeepSeek"}
              </text>
              <text fg={api.theme.current.text} wrapMode="none">
                {ds.text}
              </text>

              {/* OpenCode Go */}
              <text fg={api.theme.current.textMuted} wrapMode="none">
                {"\uD83D\uDC19 OpenCode Go"}
              </text>
              {go.map((line) => (
                <text fg={api.theme.current.text} wrapMode="none">
                  {line}
                </text>
              ))}

              {/* OpenCode Zen */}
              <text fg={api.theme.current.textMuted} wrapMode="none">
                {"\u26A1 OpenCode Zen"}
              </text>
              <text fg={api.theme.current.text} wrapMode="none">
                {zenInfo}
              </text>
              {zen.barFill > 0 ? (
                <text fg={zen.color} wrapMode="none">
                  {"\u2588".repeat(zen.barFill) + "\u2591".repeat(BAR_W - zen.barFill)}
                </text>
              ) : null}

              {/* Zen Free */}
              <text fg={api.theme.current.textMuted} wrapMode="none">
                {"\u2605 Zen Free Models"}
              </text>
              <text fg={api.theme.current.text} wrapMode="none">
                {free}
              </text>
            </box>
          );
        },
      },
    });

    return () => {
      disposed = true;
      clearInterval(ticker);
      disposeRoot();
    };
  });

  api.lifecycle.onDispose(dispose);
};

const pluginModule: TuiPluginModule & { id: string } = { id, tui };
export default pluginModule;
