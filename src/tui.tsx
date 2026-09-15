/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot, createSignal } from "solid-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const id = "@openplugins/token-balance";

// Sidebar: 42 total, paddingLeft=2, paddingRight=2 → 38 usable
const W = 38;
const BAR = 33; // bar width: 38 - space(2) - pct(3)
const REFRESH_MS = 60_000;

// ─── Helpers ──────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 60) return "#50fa7b";
  if (pct >= 30) return "#f1fa8c";
  return "#ff5555";
}

function makeBar(pct: number): { text: string; color: string } {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round((p / 100) * BAR);
  return { text: "\u2588".repeat(filled) + "\u2591".repeat(BAR - filled), color: pctColor(p) };
}

function rpad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return s + " ".repeat(w - s.length);
}

function formatTime(ms: number): string {
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

// ─── Auth ─────────────────────────────────────────────────────────────

function readAuth(): Record<string, { type?: string; key?: string }> | undefined {
  try {
    const home = os.homedir();
    for (const f of [
      path.join(home, ".local", "share", "opencode", "auth.json"),
      path.join(home, "AppData", "Roaming", "opencode", "auth.json"),
      path.join(home, "AppData", "Local", "opencode", "auth.json"),
    ]) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch {} }
  } catch {}
  return undefined;
}

function readZenCfg(): { workspaceId: string; authCookie: string } | undefined {
  try {
    const home = os.homedir();
    for (const f of [
      path.join(home, ".config", "opencode", "opencode-quota", "opencode.json"),
      path.join(home, "AppData", "Roaming", "opencode", "opencode-quota", "opencode.json"),
      path.join(home, "AppData", "Local", "opencode", "opencode-quota", "opencode.json"),
    ]) {
      try {
        const c = JSON.parse(fs.readFileSync(f, "utf8"));
        const wid = typeof c?.workspaceId === "string" ? c.workspaceId.trim() : "";
        const cookie = typeof c?.authCookie === "string" ? c.authCookie.trim() : "";
        if (wid && cookie) return { workspaceId: wid, authCookie: cookie };
      } catch {}
    }
  } catch {}
  return undefined;
}

// ─── Fetchers ─────────────────────────────────────────────────────────

interface DS { value: string; pct: number }

async function fetchDS(max: number): Promise<DS> {
  const auth = readAuth();
  const key = auth?.deepseek?.key;
  if (!key) return { value: "sin API key", pct: -1 };
  try {
    const r = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "token-balance/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { value: `error ${r.status}`, pct: -1 };
    const d = await r.json() as Record<string, unknown>;
    const infos = Array.isArray(d.balance_infos) ? d.balance_infos : [];
    const usd = infos.find((i: any) => i.currency === "USD") ?? infos[0];
    if (usd?.total_balance) {
      const bal = parseFloat(usd.total_balance);
      return { value: `${bal.toFixed(2)} USD`, pct: max > 0 ? Math.round((bal / max) * 100) : -1 };
    }
    return { value: "sin datos", pct: -1 };
  } catch { return { value: "error de conexion", pct: -1 }; }
}

interface GoLine { label: string; time: string; pct: number }

async function fetchGo(): Promise<GoLine[]> {
  const auth = readAuth();
  const key = auth?.["opencode-go"]?.key ?? auth?.opencode?.key;
  if (!key) return [{ label: "", time: "sin API key", pct: 0 }];
  try {
    const r = await fetch("https://opencode.ai/zen/go/v1/usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [{ label: "", time: `error ${r.status}`, pct: 0 }];
    const d = await r.json() as Record<string, unknown>;
    const u = d?.usage as Record<string, unknown> | undefined;
    if (!u) return [{ label: "", time: "sin datos", pct: 0 }];
    const lines: GoLine[] = [];
    for (const w of [{ key: "rolling", label: "Five-hour" }, { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" }]) {
      const win = u[w.key] as Record<string, unknown> | undefined;
      if (!win || win.status !== "ok") continue;
      const used = typeof win.percent === "number" ? win.percent : 0;
      const rem = 100 - used;
      const resetsAt = typeof win.resetsAt === "string" ? win.resetsAt : "";
      const ms = resetsAt ? Math.max(0, Date.parse(resetsAt) - Date.now()) : 0;
      lines.push({ label: w.label, time: formatTime(ms), pct: rem });
    }
    return lines.length > 0 ? lines : [{ label: "", time: "sin datos", pct: 0 }];
  } catch { return [{ label: "", time: "error de conexion", pct: 0 }]; }
}

async function fetchZen(): Promise<{ fill: number; color: string }> {
  const cfg = readZenCfg();
  if (!cfg) return { fill: 0, color: "#808080" };
  try {
    const r = await fetch(`https://opencode.ai/workspace/${encodeURIComponent(cfg.workspaceId)}/billing`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0",
        Accept: "text/html",
        Cookie: `auth=${cfg.authCookie}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { fill: 0, color: "#808080" };
    const html = await r.text();
    const U = 100_000_000;
    let balance = 0, mLimit: number | null = null, mUsage: number | null = null;
    const re = /\b(balance|monthlyLimit|monthlyUsage)\s*:\s*(\d+(?:\.\d+)?)\b/g;
    const f: Record<string, number> = {};
    for (const m of html.matchAll(re)) f[m[1]] = Number(m[2]);
    if (Number.isFinite(f.balance) && f.balance >= 0) {
      balance = f.balance / U;
      mLimit = Number.isFinite(f.monthlyLimit) && f.monthlyLimit >= 0 ? f.monthlyLimit : null;
      mUsage = Number.isFinite(f.monthlyUsage) && f.monthlyUsage >= 0 ? f.monthlyUsage / U : null;
    }
    if (balance <= 0) return { fill: 0, color: "#808080" };
    if (mLimit !== null && mUsage !== null && mLimit > 0) {
      const pct = Math.round((Math.max(0, mLimit - mUsage) / mLimit) * 100);
      return { fill: Math.round((pct / 100) * BAR), color: pctColor(pct) };
    }
    return { fill: 0, color: "#808080" };
  } catch { return { fill: 0, color: "#808080" }; }
}

// ─── TUI Plugin ───────────────────────────────────────────────────────

const tui: TuiPlugin = async (api: TuiPluginApi, options) => {
  const maxBalance = typeof options?.deepseekMaxBalance === "number" ? options.deepseekMaxBalance : 0;
  const [open, setOpen] = createSignal(api.kv?.get<boolean>("token-balance.quotaOpen", true) ?? true);

  api.keymap?.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "token-balance.toggle",
        title: "Toggle Quota",
        desc: "Collapse/expand the Quota sidebar panel",
        category: "Token Balance",
        slashName: "quota-toggle",
        run() { const v = !open(); setOpen(v); api.kv?.set("token-balance.quotaOpen", v); },
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

  const getMax = () => {
    if (maxBalance > 0) return maxBalance;
    const kv = api.kv?.get<number>("token-balance.deepseekMaxBalance", 0);
    return typeof kv === "number" && kv > 0 ? kv : 0;
  };

  const dispose = createRoot((root) => {
    const [ds, setDs] = createSignal<DS>({ value: "consultando...", pct: -1 });
    const [go, setGo] = createSignal<GoLine[]>([{ label: "", time: "consultando...", pct: 0 }]);
    const [zen, setZen] = createSignal<{ fill: number; color: string }>({ fill: 0, color: "#808080" });
    let dead = false;

    const refresh = async () => {
      if (dead) return;
      const [d, g, z] = await Promise.all([fetchDS(getMax()), fetchGo(), fetchZen()]);
      if (dead) return;
      setDs(d); setGo(g); setZen(z);
    };
    void refresh();
    const tick = setInterval(() => void refresh(), REFRESH_MS);

    api.slots.register({
      order: 151,
      slots: {
        sidebar_content() {
          const d = ds();
          const g = go();
          const z = zen();
          const isOpen = open();
          const arrow = isOpen ? "\u25BC" : "\u25B6";

          // Right-aligned value: pad label to fit value at end
          const creditsLine = rpad("Credits", W - d.value.length) + d.value;

          return (
            <box gap={0}>
              <text
                fg={api.theme.current.textMuted}
                wrapMode="none"
                onMouseDown={() => { const v = !open(); setOpen(v); api.kv?.set("token-balance.quotaOpen", v); }}
              >
                {`Quota ${arrow}`}
              </text>
              <text> </text>

              {isOpen ? (
                <>
                  <text fg={api.theme.current.textMuted} wrapMode="none">{"\uD83D\uDC33 DeepSeek"}</text>
                  <text fg={api.theme.current.text} wrapMode="none">{creditsLine}</text>
                  {d.pct >= 0 ? (() => {
                    const b = makeBar(d.pct);
                    return (
                      <text wrapMode="none">
                        <text fg={b.color}>{b.text}</text>
                        <text fg={b.color}>  {d.pct}%</text>
                      </text>
                    );
                  })() : null}
                  <text> </text>

                  <text fg={api.theme.current.textMuted} wrapMode="none">{"\uD83D\uDC19 OpenCode Go"}</text>
                  {g.map((line) => (
                    <>
                      <text fg={api.theme.current.textMuted} wrapMode="none">
                        {rpad(line.label, W - line.time.length) + line.time}
                      </text>
                      {(() => {
                        const b = makeBar(line.pct);
                        return (
                          <text wrapMode="none">
                            <text fg={b.color}>{b.text}</text>
                            <text fg={b.color}>  {line.pct}%</text>
                          </text>
                        );
                      })()}
                    </>
                  ))}
                  <text> </text>
                </>
              ) : null}

              <text fg={api.theme.current.textMuted} wrapMode="none">{"\u26A1 OpenCode Zen"}</text>
              {z.fill > 0 ? (
                <text fg={z.color} wrapMode="none">
                  {"\u2588".repeat(z.fill) + "\u2591".repeat(BAR - z.fill)}
                </text>
              ) : (
                <text fg={api.theme.current.textMuted} wrapMode="none">sin datos</text>
              )}
            </box>
          );
        },
      },
    });

    return () => { dead = true; clearInterval(tick); root(); };
  });

  api.lifecycle.onDispose(dispose);
};

const pluginModule: TuiPluginModule & { id: string } = { id, tui };
export default pluginModule;
