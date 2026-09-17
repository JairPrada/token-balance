/** @jsxImportSource @opentui/solid */
/**
 * Token Balance TUI Plugin
 *
 * Displays DeepSeek, OpenCode Go, and OpenCode Zen balances
 * in the OpenCode sidebar with auto-refresh every 60 seconds.
 */

import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createRoot, createSignal } from "solid-js";
import { readPluginConfig } from "./config.js";
import { BAR, BAR_LABEL_W, lpad, makeBar, rpad } from "./helpers.js";
import { fetchDS, fetchGo, fetchZen, type DS, type GoLine } from "./providers.js";
import { runSetupWizard } from "./wizard.js";

const id = "@openplugins/token-balance";
const W = 35;
const REFRESH_MS = 60_000;

const tui: TuiPlugin = async (api: TuiPluginApi, options) => {
  const maxBalance = typeof options?.deepseekMaxBalance === "number" ? options.deepseekMaxBalance : 0;
  const [open, setOpen] = createSignal(api.kv?.get<boolean>("token-balance.quotaOpen", true) ?? true);

  const vis = (() => {
    const saved = api.kv?.get<Record<string, boolean>>("token-balance.providers");
    if (saved) return saved;
    const cfg = readPluginConfig();
    return cfg.providers ?? { deepseek: true, "opencode-go": true, "opencode-zen": true };
  })();

  // ─── Commands ──────────────────────────────────────────────────────

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
              description: () => (
                <text fg={api.theme.current.textMuted} wrapMode="word">
                  {"Enter the total USD you loaded (e.g. 8 for $8):"}
                </text>
              ),
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
              onCancel() {
                api.ui.dialog?.clear();
              },
            }),
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
        run() {
          runSetupWizard(api);
        },
      },
    ],
    bindings: [],
  });

  // ─── Data Refresh ──────────────────────────────────────────────────

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
      setDs(d);
      setGo(g);
      setZen(z);
    };

    void refresh();
    const tick = setInterval(() => void refresh(), REFRESH_MS);

    // ─── Sidebar Rendering ─────────────────────────────────────────

    api.slots.register({
      order: 151,
      slots: {
        sidebar_content() {
          const d = ds();
          const g = go();
          const z = zen();
          const isOpen = open();
          const arrow = isOpen ? "\u25BC" : "\u25B6";
          const t = api.theme.current;
          const balanceLine = rpad("Total balance", W - d.value.length) + d.value;

          return (
            <box gap={0}>
              <text
                fg="white"
                wrapMode="none"
                onMouseDown={() => {
                  const v = !open();
                  setOpen(v);
                  api.kv?.set("token-balance.quotaOpen", v);
                }}
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

    return () => {
      dead = true;
      clearInterval(tick);
      root();
    };
  });

  api.lifecycle.onDispose(dispose);
};

const pluginModule: TuiPluginModule & { id: string } = { id, tui };
export default pluginModule;
