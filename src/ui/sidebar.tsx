/** @jsxImportSource @opentui/solid */
/**
 * Unified sidebar panel for all providers.
 */

import { createSignal, onCleanup, Show, For } from "solid-js";
import { bar, padRight, formatResetCountdown, formatPercentLabel } from "../lib/format.js";
import { fetchDeepSeekBalance } from "../providers/deepseek.js";
import { fetchOpenCodeGoQuota } from "../providers/opencode-go.js";
import { fetchOpenCodeZenBilling } from "../providers/opencode-zen.js";
import { fetchZenFreeAvailability } from "../providers/zen-free.js";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";

const SIDEBAR_WIDTH = 36;
const BAR_WIDTH = 26;
const REFRESH_INTERVAL_MS = 60_000;

export function createSidebar(api: TuiPluginApi) {
  const [deepseek, setDeepseek] = createSignal<{ status: string; text: string }>({ status: "loading", text: "Consultando..." });
  const [go, setGo] = createSignal<{ status: string; lines: string[] }>({ status: "loading", lines: ["Consultando..."] });
  const [zen, setZen] = createSignal<{ status: string; text: string; barFill: number; color: string }>({
    status: "loading", text: "Consultando...", barFill: 0, color: api.theme.current.textMuted,
  });
  const [zenFree, setZenFree] = createSignal<{ status: string; text: string }>({ status: "loading", text: "Consultando..." });
  const [checkedAt, setCheckedAt] = createSignal("");

  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

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
          status: "ready",
          text: `Total balance          USD ${total.toFixed(2)}`,
        });
      } else if (ds.error) {
        setDeepseek({ status: "nokey", text: ds.error });
      } else {
        setDeepseek({ status: "nodata", text: "sin datos" });
      }

      // OpenCode Go
      const goResult = await fetchOpenCodeGoQuota();
      if (goResult.available) {
        const lines: string[] = [];
        if (goResult.rolling) {
          const rem = formatCompact(Math.max(0, Date.parse(goResult.rolling.resetTimeIso) - Date.now()));
          lines.push(`Five-hour               ${rem}`);
          lines.push(`${bar(goResult.rolling.percentRemaining, BAR_WIDTH)}   ${formatPercentLabel(goResult.rolling.percentRemaining)}`);
        }
        if (goResult.weekly) {
          const rem = formatCompact(Math.max(0, Date.parse(goResult.weekly.resetTimeIso) - Date.now()));
          lines.push(`Weekly                  ${rem}`);
          lines.push(`${bar(goResult.weekly.percentRemaining, BAR_WIDTH)}   ${formatPercentLabel(goResult.weekly.percentRemaining)}`);
        }
        if (goResult.monthly) {
          const rem = formatCompact(Math.max(0, Date.parse(goResult.monthly.resetTimeIso) - Date.now()));
          lines.push(`Monthly                 ${rem}`);
          lines.push(`${bar(goResult.monthly.percentRemaining, BAR_WIDTH)}   ${formatPercentLabel(goResult.monthly.percentRemaining)}`);
        }
        setGo({ status: "ready", lines });
      } else if (goResult.error) {
        setGo({ status: "nokey", lines: [goResult.error] });
      } else {
        setGo({ status: "nodata", lines: ["sin datos"] });
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
            status: "ready",
            text: `Balance     USD ${b.balanceUsd.toFixed(2)}`,
            barFill: filled,
            color: pct >= 60 ? api.theme.current.success : pct >= 30 ? api.theme.current.warning : api.theme.current.error,
          });
        } else {
          setZen({
            status: "ready",
            text: `Balance     USD ${b.balanceUsd.toFixed(2)}`,
            barFill: 0,
            color: api.theme.current.textMuted,
          });
        }
      } else if (zenResult.error) {
        setZen({ status: "nokey", text: zenResult.error, barFill: 0, color: api.theme.current.textMuted });
      } else {
        setZen({ status: "nodata", text: "sin datos", barFill: 0, color: api.theme.current.textMuted });
      }

      // Zen Free
      const freeResult = await fetchZenFreeAvailability();
      if (freeResult.available) {
        const okCount = freeResult.models.filter((m) => m.status === "ok").length;
        setZenFree({
          status: "ready",
          text: `Disponibles         ahora`,
        });
      } else if (freeResult.error) {
        setZenFree({ status: "nokey", text: freeResult.error });
      } else {
        setZenFree({ status: "nodata", text: "sin datos" });
      }

      setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      // Silently ignore refresh errors
    }
  }

  // Initial fetch + interval
  void refresh();
  const ticker = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

  onCleanup(() => clearInterval(ticker));

  return { deepseek, go, zen, zenFree, checkedAt };
}

export function SidebarView(props: { api: TuiPluginApi; sessionID: string }) {
  const data = createSidebar(props.api);
  const t = () => props.api.theme.current;

  return (
    <box gap={0}>
      {/* DeepSeek */}
      <Show when={data.deepseek().status !== "nokey" || data.deepseek().text !== "No API key configured"}>
        <text fg={t().textMuted} wrapMode="none">{"\uD83D\uDC33 DeepSeek"}</text>
        <text fg={t().text} wrapMode="none">{data.deepseek().text}</text>
      </Show>

      {/* OpenCode Go */}
      <Show when={data.go().status !== "nokey" || data.go().lines[0] !== "No API key configured"}>
        <text fg={t().textMuted} wrapMode="none">{"\uD83D\uDC19 OpenCode Go"}</text>
        <For each={data.go().lines}>
          {(line) => <text fg={t().text} wrapMode="none">{line}</text>}
        </For>
      </Show>

      {/* OpenCode Zen */}
      <Show when={data.zen().status !== "nokey" || data.zen().text !== "No Zen config (workspaceId/authCookie)"}>
        <text fg={t().textMuted} wrapMode="none">{"\u26A1 OpenCode Zen"}</text>
        <text fg={t().text} wrapMode="none">{data.zen().text}</text>
        <Show when={data.zen().barFill > 0}>
          <text fg={data.zen().color} wrapMode="none">{bar(data.zen().barFill, BAR_WIDTH)}</text>
        </Show>
      </Show>

      {/* Zen Free */}
      <Show when={data.zenFree().status !== "nokey" || data.zenFree().text !== "No API key configured"}>
        <text fg={t().textMuted} wrapMode="none">{"\u2605 Zen Free Models"}</text>
        <text fg={t().text} wrapMode="none">{data.zenFree().text}</text>
      </Show>
    </box>
  );
}
