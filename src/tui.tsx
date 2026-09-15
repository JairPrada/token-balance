/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot, createSignal } from "solid-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const id = "@openplugins/token-balance";

// Sidebar: 42 total, paddingLeft=2, paddingRight=2 → 38 usable, right pad 3 → 35
const W = 35;
const BAR = 26;
const BAR_LABEL_W = W - BAR - 1;
const REFRESH_MS = 60_000;

// ─── Helpers ──────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 60) return "#98c379";
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

function lpad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return " ".repeat(w - s.length) + s;
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

function safeJson<T>(f: string): T | undefined {
  try { return JSON.parse(fs.readFileSync(f, "utf8")) as T; } catch { return undefined; }
}

// ─── Auth & Config ────────────────────────────────────────────────────

const HOME = os.homedir();
const CFG_DIR = process.env.OPENCODE_CONFIG_DIR;

function getAuthPaths(): string[] {
  const p: string[] = [];
  if (CFG_DIR) p.push(path.join(CFG_DIR, "auth.json"));
  p.push(
    path.join(HOME, ".local", "share", "opencode", "auth.json"),
    path.join(HOME, "Library", "Application Support", "opencode", "auth.json"),
    path.join(HOME, "AppData", "Roaming", "opencode", "auth.json"),
    path.join(HOME, "AppData", "Local", "opencode", "auth.json"),
  );
  return p;
}

function getPluginConfigPaths(): string[] {
  const p: string[] = [];
  if (CFG_DIR) p.push(path.join(CFG_DIR, "token-balance", "config.json"));
  p.push(
    path.join(HOME, ".config", "opencode", "token-balance", "config.json"),
    path.join(HOME, "Library", "Application Support", "opencode", "token-balance", "config.json"),
    path.join(HOME, "AppData", "Roaming", "opencode", "token-balance", "config.json"),
    path.join(HOME, "AppData", "Local", "opencode", "token-balance", "config.json"),
  );
  return p;
}

// Backwards compat: old opencode-quota plugin config
function getOldZenConfigPaths(): string[] {
  const p: string[] = [];
  if (CFG_DIR) p.push(path.join(CFG_DIR, "opencode-quota", "opencode.json"));
  p.push(
    path.join(HOME, ".config", "opencode", "opencode-quota", "opencode.json"),
    path.join(HOME, "Library", "Application Support", "opencode", "opencode-quota", "opencode.json"),
    path.join(HOME, "AppData", "Roaming", "opencode", "opencode-quota", "opencode.json"),
    path.join(HOME, "AppData", "Local", "opencode", "opencode-quota", "opencode.json"),
  );
  return p;
}

function getOpencodeConfigPaths(): string[] {
  const p: string[] = [];
  if (CFG_DIR) p.push(path.join(CFG_DIR, "opencode.json"));
  p.push(
    path.join(HOME, ".config", "opencode", "opencode.json"),
    path.join(HOME, "Library", "Application Support", "opencode", "opencode.json"),
    path.join(HOME, "AppData", "Roaming", "opencode", "opencode.json"),
    path.join(HOME, "AppData", "Local", "opencode", "opencode.json"),
  );
  return p;
}

function readFirst<T>(paths: string[]): T | undefined {
  for (const f of paths) { const v = safeJson<T>(f); if (v) return v; }
  return undefined;
}

interface AuthEntry { type?: string; key?: string }
interface PluginConfig {
  providers?: { deepseek?: boolean; "opencode-go"?: boolean; "opencode-zen"?: boolean };
  apiKeys?: { deepseek?: string; "opencode-go"?: string };
  zen?: { workspaceId?: string; authCookie?: string };
}
interface OcProvider { apiKey?: string; options?: { apiKey?: string } }
interface OpencodeConfig { provider?: Record<string, OcProvider>; providers?: Record<string, OcProvider> }

function readAuth(): Record<string, AuthEntry> | undefined {
  return readFirst<Record<string, AuthEntry>>(getAuthPaths());
}

function readPluginConfig(): PluginConfig {
  // Try new config first
  const cfg = readFirst<PluginConfig>(getPluginConfigPaths());
  if (cfg?.zen?.workspaceId && cfg?.zen?.authCookie) return cfg;

  // Fallback: old opencode-quota config (flat structure)
  const old = readFirst<{ workspaceId?: string; authCookie?: string }>(getOldZenConfigPaths());
  if (old?.workspaceId && old?.authCookie) {
    return { ...cfg, zen: { workspaceId: old.workspaceId, authCookie: old.authCookie } };
  }

  return cfg ?? {};
}

function readOpencodeConfig(): OpencodeConfig | undefined {
  return readFirst<OpencodeConfig>(getOpencodeConfigPaths());
}

function getConfigDir(): string {
  if (CFG_DIR) return CFG_DIR;
  const platform = os.platform();
  if (platform === "darwin") return path.join(HOME, "Library", "Application Support", "opencode");
  if (platform === "win32") return path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "opencode");
  return path.join(HOME, ".config", "opencode");
}

function writePluginConfig(cfg: PluginConfig): void {
  const dir = path.join(getConfigDir(), "token-balance");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(cfg, null, 2), "utf8");
}

// ─── Key Resolution (4-tier) ──────────────────────────────────────────
// Tier 1: env var → Tier 2: opencode.json → Tier 3: config.json → Tier 4: auth.json

function resolveKey(
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

// ─── Fetchers ─────────────────────────────────────────────────────────

interface DS { value: string; pct: number }

async function fetchDS(max: number): Promise<DS> {
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
    const d = await r.json() as Record<string, unknown>;
    const infos = Array.isArray(d.balance_infos) ? d.balance_infos : [];
    const usd = infos.find((i: any) => i.currency === "USD") ?? infos[0];
    if (usd?.total_balance) {
      const bal = parseFloat(usd.total_balance);
      return { value: `USD ${bal.toFixed(2)}`, pct: max > 0 ? Math.round((bal / max) * 100) : -1 };
    }
    return { value: "sin datos", pct: -1 };
  } catch { return { value: "error de conexion", pct: -1 }; }
}

interface GoLine { label: string; time: string; pct: number }

async function fetchGo(): Promise<GoLine[]> {
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

async function fetchZen(): Promise<boolean> {
  const cfg = readPluginConfig();
  const ws = cfg.zen?.workspaceId?.trim() ?? "";
  const cookie = cfg.zen?.authCookie?.trim() ?? "";
  if (!ws || !cookie) return false;
  try {
    const r = await fetch(`https://opencode.ai/workspace/${encodeURIComponent(ws)}/billing`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0",
        Accept: "text/html",
        Cookie: `auth=${cookie}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch { return false; }
}

// ─── Setup Wizard ─────────────────────────────────────────────────────

function runSetupWizard(api: TuiPluginApi) {
  const auth = readAuth();
  const cfg = readPluginConfig();

  const deepseekKey = resolveKey(auth, "deepseek", "DEEPSEEK_API_KEY");
  const goKey = resolveKey(auth, "opencode-go", "OPENCODE_API_KEY", ["opencode"]);
  const zenOk = !!(cfg.zen?.authCookie && cfg.zen?.workspaceId);

  const status = [
    `DeepSeek:      ${deepseekKey ? "✓ configured" : "✗ not found"}`,
    `OpenCode Go:   ${goKey ? "✓ configured" : "✗ not found"}`,
    `OpenCode Zen:  ${zenOk ? "✓ configured" : "✗ not configured"}`,
  ].join("\n");

  // Step 1: Show status
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Token Balance — Setup",
      description: () => <text fg={api.theme.current.textMuted} wrapMode="word">{`Current status:\n\n${status}\n\nPress Enter to start setup, or Esc to cancel.`}</text>,
      placeholder: "",
      onConfirm() {
        if (!deepseekKey) return promptDeepSeek(api, cfg, auth);
        if (!goKey) return promptGo(api, cfg, auth);
        if (!zenOk) return promptZenCookie(api, cfg);
        return showSetupDone(api);
      },
      onCancel() { api.ui.dialog?.clear(); },
    })
  );
}

function promptDeepSeek(api: TuiPluginApi, cfg: PluginConfig, auth: Record<string, AuthEntry> | undefined) {
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 1 — DeepSeek API Key",
      description: () => <text fg={api.theme.current.textMuted} wrapMode="word">{"Enter your DeepSeek API key.\nGet it at: platform.deepseek.com → API Keys\n\nOr press Enter to skip."}</text>,
      placeholder: "sk-...",
      onConfirm(value) {
        const k = value.trim();
        if (k) {
          cfg.apiKeys = { ...cfg.apiKeys, deepseek: k };
          writePluginConfig(cfg);
          api.ui.toast({ variant: "success", message: "DeepSeek key saved" });
        }
        promptGo(api, cfg, auth);
      },
      onCancel() { api.ui.dialog?.clear(); },
    })
  );
}

function promptGo(api: TuiPluginApi, cfg: PluginConfig, auth: Record<string, AuthEntry> | undefined) {
  const alreadyHas = !!resolveKey(auth, "opencode-go", "OPENCODE_API_KEY", ["opencode"]);
  if (alreadyHas) {
    if (!cfg.zen?.authCookie) return promptZenCookie(api, cfg);
    return showSetupDone(api);
  }
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 2 — OpenCode Go API Key",
      description: () => <text fg={api.theme.current.textMuted} wrapMode="word">{"Enter your OpenCode Go API key.\nIf you use OPENCODE_API_KEY env var, press Enter to skip."}</text>,
      placeholder: "your-opencode-go-key",
      onConfirm(value) {
        const k = value.trim();
        if (k) {
          cfg.apiKeys = { ...cfg.apiKeys, "opencode-go": k };
          writePluginConfig(cfg);
          api.ui.toast({ variant: "success", message: "OpenCode Go key saved" });
        }
        if (!cfg.zen?.authCookie) return promptZenCookie(api, cfg);
        showSetupDone(api);
      },
      onCancel() { api.ui.dialog?.clear(); },
    })
  );
}

function promptZenCookie(api: TuiPluginApi, cfg: PluginConfig) {
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 3 — OpenCode Zen Cookie",
      description: () => <text fg={api.theme.current.textMuted} wrapMode="word">{"To get your Zen cookie:\n\n1. Open opencode.ai in your browser\n2. Log in to your account\n3. Press F12 → Application → Cookies\n4. Find the 'auth' cookie for opencode.ai\n5. Copy its value and paste it below\n\nPress Enter to skip Zen setup."}</text>,
      placeholder: "paste auth cookie value here",
      onConfirm(value) {
        const c = value.trim();
        if (c) {
          cfg.zen = { ...cfg.zen, authCookie: c };
          writePluginConfig(cfg);
          promptZenWorkspace(api, cfg);
        } else {
          showSetupDone(api);
        }
      },
      onCancel() { api.ui.dialog?.clear(); },
    })
  );
}

function promptZenWorkspace(api: TuiPluginApi, cfg: PluginConfig) {
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 4 — Workspace ID",
      description: () => <text fg={api.theme.current.textMuted} wrapMode="word">{"Enter your OpenCode workspace ID.\n\nFind it in the URL when you open opencode.ai:\n  opencode.ai/workspace/wrk_XXXXX/...\n\nPaste the workspace ID below."}</text>,
      placeholder: "wrk_...",
      onConfirm(value) {
        const w = value.trim();
        if (w) {
          cfg.zen = { ...cfg.zen, workspaceId: w };
          writePluginConfig(cfg);
          api.ui.toast({ variant: "success", message: "Zen workspace ID saved" });
        }
        showSetupDone(api);
      },
      onCancel() { api.ui.dialog?.clear(); },
    })
  );
}

function showSetupDone(api: TuiPluginApi) {
  const cfg = readPluginConfig();
  const auth = readAuth();
  const lines = [
    "Setup complete! Restart OpenCode to apply.",
    "",
    `DeepSeek:      ${resolveKey(auth, "deepseek", "DEEPSEEK_API_KEY") ? "✓" : "✗"}`,
    `OpenCode Go:   ${resolveKey(auth, "opencode-go", "OPENCODE_API_KEY", ["opencode"]) ? "✓" : "✗"}`,
    `OpenCode Zen:  ${cfg.zen?.authCookie ? "✓" : "✗"}`,
  ];
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Token Balance — Done",
      description: () => <text fg={api.theme.current.textMuted} wrapMode="word">{lines.join("\n")}</text>,
      placeholder: "",
      onConfirm() { api.ui.dialog?.clear(); },
      onCancel() { api.ui.dialog?.clear(); },
    })
  );
}

// ─── TUI Plugin ───────────────────────────────────────────────────────

const PROVIDER_IDS = ["deepseek", "opencode-go", "opencode-zen"] as const;
const PROVIDER_NAMES: Record<string, string> = { deepseek: "DeepSeek", "opencode-go": "OpenCode Go", "opencode-zen": "OpenCode Zen" };

const tui: TuiPlugin = async (api: TuiPluginApi, options) => {
  const maxBalance = typeof options?.deepseekMaxBalance === "number" ? options.deepseekMaxBalance : 0;
  const [open, setOpen] = createSignal(api.kv?.get<boolean>("token-balance.quotaOpen", true) ?? true);

  const getEnabled = (): Record<string, boolean> => {
    const saved = api.kv?.get<Record<string, boolean>>("token-balance.providers");
    if (saved) return saved;
    const cfg = readPluginConfig();
    return cfg.providers ?? { deepseek: true, "opencode-go": true, "opencode-zen": true };
  };
  const [enabled, setEnabled] = createSignal<Record<string, boolean>>(getEnabled());

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
      {
        namespace: "palette",
        name: "token-balance.toggle-provider",
        title: "Toggle Provider",
        desc: "Show or hide a provider in the Quota sidebar",
        category: "Token Balance",
        slashName: "toggle-provider",
        run() {
          const cur = enabled();
          api.ui?.dialog?.replace?.(() =>
            api.ui.DialogPrompt({
              title: "Toggle Provider",
              description: () => {
                const list = PROVIDER_IDS.map(k => `${PROVIDER_NAMES[k]}(${cur[k] !== false ? "on" : "off"})`).join("  ");
                return `${list}  — enter name to toggle`;
              },
              placeholder: "deepseek",
              onConfirm(value: string) {
                const k = value.trim().toLowerCase();
                if (PROVIDER_IDS.includes(k as any)) {
                  const next = { ...cur, [k]: cur[k] === false ? true : false };
                  setEnabled(next);
                  api.kv?.set("token-balance.providers", next);
                  api.ui.toast({ variant: "success", message: `${PROVIDER_NAMES[k]} ${next[k] ? "enabled" : "disabled"}` });
                } else { api.ui.toast({ variant: "error", message: "Use: deepseek, opencode-go, opencode-zen" }); }
                api.ui.dialog?.clear();
              },
              onCancel() { api.ui.dialog?.clear(); },
            })
          );
        },
      },
      {
        namespace: "palette",
        name: "token-balance.setup",
        title: "Setup Wizard",
        desc: "Step-by-step setup for DeepSeek, OpenCode Go, and OpenCode Zen",
        category: "Token Balance",
        slashName: "tb-setup",
        run() { runSetupWizard(api); },
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
    const [zen, setZen] = createSignal<boolean>(false);
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
          const vis = enabled();
          const t = api.theme.current;

          const balanceLine = rpad("Total balance", W - d.value.length) + d.value;

          return (
            <box gap={0}>
              <text
                fg={t.textMuted}
                wrapMode="none"
                onMouseDown={() => { const v = !open(); setOpen(v); api.kv?.set("token-balance.quotaOpen", v); }}
              >
                {`${arrow} Quota`}
              </text>
              <text> </text>

              {isOpen ? (
                <>
                  {vis.deepseek !== false ? (
                    <>
                      <text fg={t.textMuted} wrapMode="none">{"\uD83D\uDC33 DeepSeek"}</text>
                      <text fg={t.text} wrapMode="none">{balanceLine}</text>
                      {d.pct >= 0 ? (() => {
                        const b = makeBar(d.pct);
                        return (
                          <text fg={b.color} wrapMode="none">{b.text} {lpad(`${d.pct}%`, BAR_LABEL_W)}</text>
                        );
                      })() : null}
                      <text> </text>
                    </>
                  ) : null}

                  {vis["opencode-go"] !== false ? (
                    <>
                      <text fg={t.textMuted} wrapMode="none">{"\uD83D\uDC19 OpenCode Go"}</text>
                      {g.map((line) => (
                        <>
                          <text fg={t.textMuted} wrapMode="none">
                            {rpad(line.label, W - line.time.length) + line.time}
                          </text>
                          {(() => {
                            const b = makeBar(line.pct);
                            return (
                              <text fg={b.color} wrapMode="none">{b.text} {lpad(`${line.pct}% left`, BAR_LABEL_W)}</text>
                            );
                          })()}
                        </>
                      ))}
                      <text> </text>
                    </>
                  ) : null}

                  {vis["opencode-zen"] !== false ? (
                    <>
                      <text fg={t.textMuted} wrapMode="none">{"\u26A1 OpenCode Zen"}</text>
                      <text fg={t.textMuted} wrapMode="none">
                        {z ? rpad("Disponibles", W - 5) + "ahora" : "sin configurar"}
                      </text>
                      {z ? (
                        <text fg="#98c379" wrapMode="none">{"\u2588".repeat(BAR)}</text>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
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
