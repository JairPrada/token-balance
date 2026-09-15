/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot, createSignal } from "solid-js";
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
  return {
    text: "\u2588".repeat(filled) + "\u2591".repeat(width - filled),
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
  return totalHours >= 1 ? `${totalHours}h` : `${totalMinutes % 60}m`;
}

function rpad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

// ─── Auth helpers ─────────────────────────────────────────────────────

function readAuthFile(): Record<string, { type?: string; key?: string }> | undefined {
  try {
    const home = os.homedir();
    for (const file of [
      path.join(home, ".local", "share", "opencode", "auth.json"),
      path.join(home, "AppData", "Roaming", "opencode", "auth.json"),
      path.join(home, "AppData", "Local", "opencode", "auth.json"),
    ]) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch {} }
  } catch {}
  return undefined;
}

function readZenConfig(): { workspaceId: string; authCookie: string } | undefined {
  try {
    const home = os.homedir();
    for (const file of [
      path.join(home, ".config", "opencode", "opencode-quota", "opencode.json"),
      path.join(home, "AppData", "Roaming", "opencode", "opencode-quota", "opencode.json"),
      path.join(home, "AppData", "Local", "opencode", "opencode-quota", "opencode.json"),
    ]) {
      try {
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        const workspaceId = typeof config?.workspaceId === "string" ? config.workspaceId.trim() : "";
        const authCookie = typeof config?.authCookie === "string" ? config.authCookie.trim() : "";
        if (workspaceId && authCookie) return { workspaceId, authCookie };
      } catch {}
    }
  } catch {}
  return undefined;
}

// ─── Provider fetchers ────────────────────────────────────────────────

interface DeepSeekResult { text: string; barPercent: number; barColor: string }

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
      return { text: `Total balance               USD ${balance.toFixed(2)}`, barPercent: pct, barColor: pct >= 0 ? pctColor(pct) : "#808080" };
    }
    return { text: "sin datos", barPercent: -1, barColor: "#808080" };
  } catch { return { text: "error de conexion", barPercent: -1, barColor: "#808080" }; }
}

interface GoLine { label: string; remaining: string; barText: string; barColor: string }

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
    for (const w of [{ key: "rolling", label: "Five-hour" }, { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" }]) {
      const win = usage[w.key] as Record<string, unknown> | undefined;
      if (!win || win.status !== "ok") continue;
      const remaining = 100 - (typeof win.percent === "number" ? win.percent : 0);
      const resetsAt = typeof win.resetsAt === "string" ? win.resetsAt : "";
      const resetMs = resetsAt ? Math.max(0, Date.parse(resetsAt) - Date.now()) : 0;
      const bar = barColored(remaining, BAR_W);
      lines.push({ label: w.label, remaining: formatCompact(resetMs), barText: bar.text, barColor: bar.color });
    }
    return lines.length > 0 ? lines : [{ label: "", remaining: "sin datos", barText: "", barColor: "#808080" }];
  } catch { return [{ label: "", remaining: "error de conexion", barText: "", barColor: "#808080" }]; }
}

async function fetchOpenCodeZen(): Promise<{ text: string; barFill: number; barColor: string }> {
  const config = readZenConfig();
  if (!config) return { text: "sin config", barFill: 0, barColor: "#808080" };
  try {
    const res = await fetch(`https://opencode.ai/workspace/${encodeURIComponent(config.workspaceId)}/billing`, {
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
      const pct = Math.round((Math.max(0, monthlyLimit - monthlyUsage) / monthlyLimit) * 100);
      return { text: `Balance                USD ${balance.toFixed(2)}`, barFill: Math.round((pct / 100) * BAR_W), barColor: pctColor(pct) };
    }
    return { text: `Balance                USD ${balance.toFixed(2)}`, barFill: 0, barColor: "#808080" };
  } catch { return { text: "error de conexion", barFill: 0, barColor: "#808080" }; }
}

// ─── TUI Plugin ───────────────────────────────────────────────────────

const tui: TuiPlugin = async (api: TuiPluginApi, options) => {
  const maxBalance = typeof options?.deepseekMaxBalance === "number" ? options.deepseekMaxBalance : 0;
  const [quotaOpen, setQuotaOpen] = createSignal(api.kv?.get<boolean>("token-balance.quotaOpen", true) ?? true);

  // Toggle command
  api.keymap?.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "token-balance.toggle",
        title: "Toggle Quota",
        desc: "Collapse/expand the Quota sidebar panel",
        category: "Token Balance",
        slashName: "quota-toggle",
        run() { const v = !quotaOpen(); setQuotaOpen(v); api.kv?.set("token-balance.quotaOpen", v); },
      },
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
                } else { api.ui.toast({ variant: "error", message: "Invalid amount" }); }
                api.ui.dialog?.clear();
              },
              onCancel() { api.ui.dialog?.clear(); },
            })
          );
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
      const [ds, go, zen] = await Promise.all([fetchDeepSeek(mb), fetchOpenCodeGo(), fetchOpenCodeZen()]);
      if (disposed) return;
      setDsData(ds); setGoData(go); setZenData(zen);
    };
    void refresh();
    const ticker = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    // Go line: label on left, time right-aligned in 8-char field
    const goLine = (line: GoLine) => (
      <>
        <text fg={api.theme.current.textMuted} wrapMode="none">
          {line.label ? `${rpad(line.label, 14)}${rpad(line.remaining, 8)}` : rpad(line.remaining, 22)}
        </text>
        {line.barText ? <text fg={line.barColor} wrapMode="none">{line.barText}</text> : null}
      </>
    );

    // Zen section (shared between inside Quota and standalone)
    const zenSection = () => {
      const zen = zenData();
      return (
        <>
          <text fg={api.theme.current.textMuted} wrapMode="none">
            {"\u26A1 OpenCode Zen"}
          </text>
          <text fg={api.theme.current.text} wrapMode="none">{zen.text}</text>
          {zen.barFill > 0 ? (
            <text fg={zen.barColor} wrapMode="none">
              {"\u2588".repeat(zen.barFill) + "\u2591".repeat(BAR_W - zen.barFill)}
            </text>
          ) : null}
        </>
      );
    };

    api.slots.register({
      order: 151,
      slots: {
        sidebar_content() {
          const ds = dsData();
          const go = goData();
          const zen = zenData();
          const open = quotaOpen();
          const arrow = open ? "\u25BC" : "\u25B6";

          return (
            <box gap={0}>
              {/* Clickable Quota title */}
              <text
                fg={api.theme.current.accent}
                wrapMode="none"
                onMouseDown={() => { const v = !quotaOpen(); setQuotaOpen(v); api.kv?.set("token-balance.quotaOpen", v); }}
              >
                {`Quota ${arrow}`}
              </text>

              {open ? (
                <>
                  {/* DeepSeek */}
                  <text fg={api.theme.current.textMuted} wrapMode="none">
                    {"\uD83D\uDC33 DeepSeek"}
                  </text>
                  <text fg={api.theme.current.text} wrapMode="none">{ds.text}</text>
                  {ds.barPercent >= 0 ? (() => {
                    const b = barColored(ds.barPercent, BAR_W);
                    return <text fg={b.color} wrapMode="none">{`${b.text}   ${ds.barPercent}%`}</text>;
                  })() : null}

                  {/* OpenCode Go */}
                  <text fg={api.theme.current.textMuted} wrapMode="none">
                    {"\uD83D\uDC19 OpenCode Go"}
                  </text>
                  {go.map((line) => goLine(line))}
                </>
              ) : null}

              {/* Zen always visible (outside Quota collapse) */}
              {zenSection()}
            </box>
          );
        },
      },
    });

    return () => { disposed = true; clearInterval(ticker); disposeRoot(); };
  });

  api.lifecycle.onDispose(dispose);
};

const pluginModule: TuiPluginModule & { id: string } = { id, tui };
export default pluginModule;
