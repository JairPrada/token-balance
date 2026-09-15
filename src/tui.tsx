/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot, createSignal, onCleanup } from "solid-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const id = "@openplugins/token-balance";
const BAR_W = 26;
const REFRESH_INTERVAL_MS = 60_000;

// ─── Color helpers ────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 60) return "#50fa7b";
  if (pct >= 30) return "#f1fa8c";
  return "#ff5555";
}

function barColored(percent: number, width: number): { text: string; color: string } {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  return {
    text: "\u2588".repeat(filled) + "\u2591".repeat(empty),
    color: pctColor(p),
  };
}

// ─── Formatting ───────────────────────────────────────────────────────

function formatCompact(ms: number): string {
  if (ms <= 0) return "ahora";
  const totalMinutes = Math.ceil(ms / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const remainH = totalHours % 24;
    return remainH > 0 ? `${days}d ${remainH}h` : `${days}d`;
  }
  const hours = totalHours;
  const minutes = totalMinutes % 60;
  return hours >= 1 ? `${hours}h` : `${minutes}m`;
}

/** Right-pad a string to a fixed width */
function rpad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

// ─── Auth helpers (sync) ──────────────────────────────────────────────

function readAuthFile(): Record<string, { type?: string; key?: string }> | undefined {
  try {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".local", "share", "opencode", "auth.json"),
      path.join(home, "AppData", "Roaming", "opencode", "auth.json"),
      path.join(home, "AppData", "Local", "opencode", "auth.json"),
    ];
    for (const file of candidates) {
      try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* next */ }
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
      } catch { /* next */ }
    }
  } catch { /* ignore */ }
  return undefined;
}

// ─── Provider fetchers ────────────────────────────────────────────────

interface DeepSeekResult {
  text: string;
  barPercent: number;
  barColor: string;
}

async function fetchDeepSeek(maxBalance: number): Promise<DeepSeekResult> {
  const auth = readAuthFile();
  const key = auth?.deepseek?.key;
  if (!key) return { text: "sin API key", barPercent: -1, barColor: "#808080" };
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "token-balance/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { text: `error ${res.status}`, barPercent: -1, barColor: "#808080" };
    const data = await res.json() as Record<string, unknown>;
    const infos = Array.isArray(data.balance_infos) ? data.balance_infos : [];
    const usd = infos.find((i: any) => i.currency === "USD") ?? infos[0];
    if (usd?.total_balance) {
      const balance = parseFloat(usd.total_balance);
      const pct = maxBalance > 0 ? Math.round((balance / maxBalance) * 100) : -1;
      return {
        text: `Total balance               USD ${balance.toFixed(2)}`,
        barPercent: pct,
        barColor: pct >= 0 ? pctColor(pct) : "#808080",
      };
    }
    return { text: "sin datos", barPercent: -1, barColor: "#808080" };
  } catch { return { text: "error de conexion", barPercent: -1, barColor: "#808080" }; }
}

interface GoLine {
  label: string;
  remaining: string;
  barText: string;
  barColor: string;
}

async function fetchOpenCodeGo(): Promise<GoLine[]> {
  const auth = readAuthFile();
  const key = auth?.["opencode-go"]?.key ?? auth?.opencode?.key;
  if (!key) return [{ label: "", remaining: "sin API key", barText: "", barColor: "#808080" }];
  try {
    const res = await fetch("https://opencode.ai/zen/go/v1/usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [{ label: "", remaining: `error ${res.status}`, barText: "", barColor: "#808080" }];
    const data = await res.json() as Record<string, unknown>;
    const usage = data?.usage as Record<string, unknown> | undefined;
    if (!usage) return [{ label: "", remaining: "sin datos", barText: "", barColor: "#808080" }];

    const lines: GoLine[] = [];
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
      const bar = barColored(remaining, BAR_W);
      lines.push({ label: w.label, remaining: rem, barText: bar.text, barColor: bar.color });
    }
    return lines.length > 0 ? lines : [{ label: "", remaining: "sin datos", barText: "", barColor: "#808080" }];
  } catch { return [{ label: "", remaining: "error de conexion", barText: "", barColor: "#808080" }]; }
}

async function fetchOpenCodeZen(): Promise<{ text: string; barFill: number; barColor: string }> {
  const config = readZenConfig();
  if (!config) return { text: "sin config", barFill: 0, barColor: "#808080" };
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
    if (!res.ok) return { text: `error ${res.status}`, barFill: 0, barColor: "#808080" };
    const html = await res.text();
    const BILLING_UNITS = 100_000_000;
    let balance = 0;
    let monthlyLimit: number | null = null;
    let monthlyUsage: number | null = null;
    const ssrRe = /\b(balance|monthlyLimit|monthlyUsage)\s*:\s*(\d+(?:\.\d+)?)\b/g;
    const fields: Record<string, number> = {};
    for (const m of html.matchAll(ssrRe)) fields[m[1]] = Number(m[2]);
    if (Number.isFinite(fields.balance) && fields.balance >= 0) {
      balance = fields.balance / BILLING_UNITS;
      monthlyLimit = Number.isFinite(fields.monthlyLimit) && fields.monthlyLimit >= 0 ? fields.monthlyLimit : null;
      monthlyUsage = Number.isFinite(fields.monthlyUsage) && fields.monthlyUsage >= 0 ? fields.monthlyUsage / BILLING_UNITS : null;
    }
    if (balance <= 0) return { text: "sin datos", barFill: 0, barColor: "#808080" };
    if (monthlyLimit !== null && monthlyUsage !== null && monthlyLimit > 0) {
      const remaining = Math.max(0, monthlyLimit - monthlyUsage);
      const pct = Math.round((remaining / monthlyLimit) * 100);
      const filled = Math.round((pct / 100) * BAR_W);
      return { text: `Balance                USD ${balance.toFixed(2)}`, barFill: filled, barColor: pctColor(pct) };
    }
    return { text: `Balance                USD ${balance.toFixed(2)}`, barFill: 0, barColor: "#808080" };
  } catch { return { text: "error de conexion", barFill: 0, barColor: "#808080" }; }
}

// ─── TUI Plugin ───────────────────────────────────────────────────────

const tui: TuiPlugin = async (api: TuiPluginApi, options) => {
  const maxBalance = typeof options?.deepseekMaxBalance === "number" ? options.deepseekMaxBalance : 0;

  // Collapsed state
  const [collapsed, setCollapsed] = createSignal(api.kv?.get<boolean>("token-balance.collapsed", false) ?? false);

  // Register commands
  api.keymap?.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "token-balance.set-max-balance",
        title: "Set DeepSeek Max Balance",
        desc: "Set the total USD loaded in DeepSeek for percentage display",
        category: "Token Balance",
        slashName: "set-max-balance",
        run() {
          api.ui?.dialog?.replace?.(() =>
            api.ui.DialogPrompt({
              title: "DeepSeek Max Balance",
              description: () => "Enter the total USD you loaded (e.g. 8 for $8):",
              placeholder: "8",
              onConfirm(value: string) {
                const num = parseFloat(value);
                if (Number.isFinite(num) && num > 0) {
                  api.kv?.set("token-balance.deepseekMaxBalance", num);
                  api.ui.toast({ variant: "success", message: `DeepSeek max balance set to $${num.toFixed(2)}` });
                } else {
                  api.ui.toast({ variant: "error", message: "Invalid amount" });
                }
                api.ui.dialog?.clear();
              },
              onCancel() { api.ui.dialog?.clear(); },
            })
          );
        },
      },
      {
        namespace: "palette",
        name: "token-balance.toggle",
        title: "Toggle Quota Panel",
        desc: "Collapse/expand the Quota sidebar panel",
        category: "Token Balance",
        slashName: "quota-toggle",
        run() {
          const next = !collapsed();
          setCollapsed(next);
          api.kv?.set("token-balance.collapsed", next);
        },
      },
    ],
    bindings: [],
  });

  const getMaxBalance = () => {
    if (maxBalance > 0) return maxBalance;
    const kv = api.kv?.get<number>("token-balance.deepseekMaxBalance", 0);
    return typeof kv === "number" && kv > 0 ? kv : 0;
  };

  const dispose = createRoot((disposeRoot) => {
    const [dsData, setDsData] = createSignal<DeepSeekResult>({ text: "consultando...", barPercent: -1, barColor: "#808080" });
    const [goData, setGoData] = createSignal<GoLine[]>([{ label: "", remaining: "consultando...", barText: "", barColor: "#808080" }]);
    const [zenData, setZenData] = createSignal<{ text: string; barFill: number; barColor: string }>({ text: "consultando...", barFill: 0, barColor: "#808080" });
    let disposed = false;

    const refresh = async () => {
      if (disposed) return;
      const mb = getMaxBalance();
      const [ds, go, zen] = await Promise.all([
        fetchDeepSeek(mb),
        fetchOpenCodeGo(),
        fetchOpenCodeZen(),
      ]);
      if (disposed) return;
      setDsData(ds);
      setGoData(go);
      setZenData(zen);
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
          const isCollapsed = collapsed();
          const arrow = isCollapsed ? "\u25B6" : "\u25BC";  // ▶ / ▼

          return (
            <box gap={0}>
              {/* Quota title (collapsible) */}
              <text fg={api.theme.current.accent} wrapMode="none">
                {`Quota ${arrow}`}
              </text>

              {!isCollapsed ? (
                <>
                  {/* DeepSeek */}
                  <text fg={api.theme.current.textMuted} wrapMode="none">
                    {"  \uD83D\uDC33 DeepSeek"}
                  </text>
                  <text fg={api.theme.current.text} wrapMode="none">
                    {`  ${ds.text}`}
                  </text>
                  {ds.barPercent >= 0 ? (() => {
                    const b = barColored(ds.barPercent, BAR_W);
                    return <text fg={b.color} wrapMode="none">{`  ${b.text}   ${ds.barPercent}%`}</text>;
                  })() : null}

                  {/* OpenCode Go */}
                  <text fg={api.theme.current.textMuted} wrapMode="none">
                    {"  \uD83D\uDC19 OpenCode Go"}
                  </text>
                  {go.map((line) => (
                    <>
                      <text fg={api.theme.current.textMuted} wrapMode="none">
                        {`  ${line.label ? rpad(line.label, 14) + rpad(line.remaining, 8) : line.remaining}`}
                      </text>
                      {line.barText ? (
                        <text fg={line.barColor} wrapMode="none">
                          {`  ${line.barText}`}
                        </text>
                      ) : null}
                    </>
                  ))}

                  {/* OpenCode Zen */}
                  <text fg={api.theme.current.textMuted} wrapMode="none">
                    {"  \u26A1 OpenCode Zen"}
                  </text>
                  <text fg={api.theme.current.text} wrapMode="none">
                    {`  ${zen.text}`}
                  </text>
                  {zen.barFill > 0 ? (
                    <text fg={zen.barColor} wrapMode="none">
                      {`  ${"\u2588".repeat(zen.barFill) + "\u2591".repeat(BAR_W - zen.barFill)}`}
                    </text>
                  ) : null}
                </>
              ) : null}
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
