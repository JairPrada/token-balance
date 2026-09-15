/** @jsxImportSource @opentui/solid */
/**
 * Unified sidebar panel for all providers.
 */

import { createSignal, onCleanup, Show, For } from "solid-js";
import { bar, formatPercentLabel } from "../lib/format.js";
import { fetchDeepSeekBalance } from "../providers/deepseek.js";
import { fetchOpenCodeGoQuota } from "../providers/opencode-go.js";
import { fetchOpenCodeZenBilling } from "../providers/opencode-zen.js";
import { fetchZenFreeAvailability } from "../providers/zen-free.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

const BAR_WIDTH = 26;
const REFRESH_INTERVAL_MS = 60_000;

export function createSidebar(api: TuiPluginApi) {
  const [deepseek, setDeepseek] = createSignal<{ text: string; subtext: string }>({ text: "Consultando...", subtext: "" });
  const [go, setGo] = createSignal<{ lines: string[] }>({ lines: ["Consultando..."] });
  const [zen, setZen] = createSignal<{ text: string; barFill: number; color: string }>({
    text: "Consultando...", barFill: 0, color: api.theme.current.textMuted,
  });
  const [zenFree, setZenFree] = createSignal<{ text: string }>({ text: "Consultando..." });

  function formatCompact(ms: number): string {
    if (ms <= 0) return "ahora";
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours >= 1 ? `${hours}h` : `${minutes}m`;
  }

  async function refresh() {
    try {
      // DeepSeek
      const ds = await fetchDeepSeekBalance();
      if (ds.available && ds.balances.length > 0) {
        const usd = ds.balances.find((b) => b.currency === "USD") ?? ds.balances[0];
        const total = usd.totalBalance ? parseFloat(usd.totalBalance) : 0;
        setDeepseek({
          text: `Total balance               USD ${total.toFixed(2)}`,
          subtext: "",
        });
      } else {
        setDeepseek({ text: ds.error ?? "sin datos", subtext: "" });
      }

      // OpenCode Go
      const goResult = await fetchOpenCodeGoQuota();
      if (goResult.available) {
        const lines: string[] = [];
        if (goResult.rolling) {
          const rem = formatCompact(Math.max(0, Date.parse(goResult.rolling.resetTimeIso) - Date.now()));
          lines.push(`Five-hour                         ${rem}`);
          lines.push(`${bar(goResult.rolling.percentRemaining, BAR_WIDTH)}   ${formatPercentLabel(goResult.rolling.percentRemaining)}`);
        }
        if (goResult.weekly) {
          const rem = formatCompact(Math.max(0, Date.parse(goResult.weekly.resetTimeIso) - Date.now()));
          lines.push(`Weekly                            ${rem}`);
          lines.push(`${bar(goResult.weekly.percentRemaining, BAR_WIDTH)}   ${formatPercentLabel(goResult.weekly.percentRemaining)}`);
        }
        if (goResult.monthly) {
          const rem = formatCompact(Math.max(0, Date.parse(goResult.monthly.resetTimeIso) - Date.now()));
          lines.push(`Monthly                          ${rem}`);
          lines.push(`${bar(goResult.monthly.percentRemaining, BAR_WIDTH)}   ${formatPercentLabel(goResult.monthly.percentRemaining)}`);
        }
        setGo({ lines });
      } else {
        setGo({ lines: [goResult.error ?? "sin datos"] });
      }

      // OpenCode Zen (billing)
      const zenResult = await fetchOpenCodeZenBilling();
      if (zenResult.available && zenResult.billing) {
        const b = zenResult.billing;
        if (b.monthlyLimitUsd !== null && b.monthlyUsageUsd !== null) {
          const remaining = Math.max(0, b.monthlyLimitUsd - b.monthlyUsageUsd);
          const pct = Math.round((remaining / b.monthlyLimitUsd) * 100);
          const filled = Math.round((pct / 100) * BAR_WIDTH);
          setZen({
            text: `Balance                USD ${b.balanceUsd.toFixed(2)}`,
            barFill: filled,
            color: pct >= 60 ? api.theme.current.success : pct >= 30 ? api.theme.current.warning : api.theme.current.error,
          });
        } else {
          setZen({
            text: `Balance                USD ${b.balanceUsd.toFixed(2)}`,
            barFill: 0,
            color: api.theme.current.textMuted,
          });
        }
      } else {
        setZen({
          text: zenResult.error ?? "sin datos",
          barFill: 0,
          color: api.theme.current.textMuted,
        });
      }

      // Zen Free
      const freeResult = await fetchZenFreeAvailability();
      if (freeResult.available) {
        const okCount = freeResult.models.filter((m) => m.status === "ok").length;
        setZenFree({ text: `Disponibles                    ahora` });
      } else {
        setZenFree({ text: freeResult.error ?? "sin datos" });
      }
    } catch {
      // Silently ignore refresh errors
    }
  }

  // Initial fetch + interval
  void refresh();
  const ticker = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
  onCleanup(() => clearInterval(ticker));

  return { deepseek, go, zen, zenFree };
}

export function SidebarView(props: { api: TuiPluginApi; sessionID: string }) {
  const data = createSidebar(props.api);
  const t = () => props.api.theme.current;

  return (
    <box gap={0}>
      {/* DeepSeek */}
      <text fg={t().textMuted} wrapMode="none">{"\uD83D\uDC33 DeepSeek"}</text>
      <text fg={t().text} wrapMode="none">{data.deepseek().text}</text>

      {/* OpenCode Go */}
      <text fg={t().textMuted} wrapMode="none">{"\uD83D\uDC19 OpenCode Go"}</text>
      <For each={data.go().lines}>
        {(line) => <text fg={t().text} wrapMode="none">{line}</text>}
      </For>

      {/* OpenCode Zen */}
      <text fg={t().textMuted} wrapMode="none">{"\u26A1 OpenCode Zen"}</text>
      <text fg={t().text} wrapMode="none">{data.zen().text}</text>
      <Show when={data.zen().barFill > 0}>
        <text fg={data.zen().color} wrapMode="none">{bar(data.zen().barFill, BAR_WIDTH)}</text>
      </Show>

      {/* Zen Free */}
      <text fg={t().textMuted} wrapMode="none">{"\u2605 Zen Free Models"}</text>
      <text fg={t().text} wrapMode="none">{data.zenFree().text}</text>
    </box>
  );
}
