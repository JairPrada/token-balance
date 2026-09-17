/** @jsxImportSource @opentui/solid */
/**
 * Setup wizard for configuring provider credentials.
 *
 * Walks the user through DeepSeek, OpenCode Go, and OpenCode Zen setup
 * via interactive TUI dialogs.
 */

import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import {
  type AuthEntry,
  type PluginConfig,
  readAuth,
  readPluginConfig,
  writePluginConfig,
} from "./config.js";
import { resolveKey } from "./providers.js";

export function runSetupWizard(api: TuiPluginApi) {
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

  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Token Balance — Setup",
      description: () => (
        <text fg={api.theme.current.textMuted} wrapMode="word">
          {`Current status:\n\n${status}\n\nPress Enter to start setup, or Esc to cancel.`}
        </text>
      ),
      placeholder: "",
      onConfirm() {
        if (!deepseekKey) return promptDeepSeek(api, cfg, auth);
        if (!goKey) return promptGo(api, cfg, auth);
        if (!zenOk) return promptZenCookie(api, cfg);
        return showSetupDone(api);
      },
      onCancel() {
        api.ui.dialog?.clear();
      },
    }),
  );
}

function promptDeepSeek(
  api: TuiPluginApi,
  cfg: PluginConfig,
  auth: Record<string, AuthEntry> | undefined,
) {
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 1 — DeepSeek API Key",
      description: () => (
        <text fg={api.theme.current.textMuted} wrapMode="word">
          {"Enter your DeepSeek API key.\nGet it at: platform.deepseek.com → API Keys\n\nOr press Enter to skip."}
        </text>
      ),
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
      onCancel() {
        api.ui.dialog?.clear();
      },
    }),
  );
}

function promptGo(
  api: TuiPluginApi,
  cfg: PluginConfig,
  auth: Record<string, AuthEntry> | undefined,
) {
  const alreadyHas = !!resolveKey(auth, "opencode-go", "OPENCODE_API_KEY", ["opencode"]);
  if (alreadyHas) {
    if (!cfg.zen?.authCookie) return promptZenCookie(api, cfg);
    return showSetupDone(api);
  }

  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 2 — OpenCode Go API Key",
      description: () => (
        <text fg={api.theme.current.textMuted} wrapMode="word">
          {"Enter your OpenCode Go API key.\nIf you use OPENCODE_API_KEY env var, press Enter to skip."}
        </text>
      ),
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
      onCancel() {
        api.ui.dialog?.clear();
      },
    }),
  );
}

function promptZenCookie(api: TuiPluginApi, cfg: PluginConfig) {
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 3 — OpenCode Zen Cookie",
      description: () => (
        <text fg={api.theme.current.textMuted} wrapMode="word">
          {"To get your Zen cookie:\n\n1. Open opencode.ai in your browser\n2. Log in to your account\n3. Press F12 → Application → Cookies\n4. Find the 'auth' cookie for opencode.ai\n5. Copy its value and paste it below\n\nPress Enter to skip Zen setup."}
        </text>
      ),
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
      onCancel() {
        api.ui.dialog?.clear();
      },
    }),
  );
}

function promptZenWorkspace(api: TuiPluginApi, cfg: PluginConfig) {
  api.ui?.dialog?.replace?.(() =>
    api.ui.DialogPrompt({
      title: "Step 4 — Workspace ID",
      description: () => (
        <text fg={api.theme.current.textMuted} wrapMode="word">
          {"Enter your OpenCode workspace ID.\n\nFind it in the URL when you open opencode.ai:\n  opencode.ai/workspace/wrk_XXXXX/...\n\nPaste the workspace ID below."}
        </text>
      ),
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
      onCancel() {
        api.ui.dialog?.clear();
      },
    }),
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
      description: () => (
        <text fg={api.theme.current.textMuted} wrapMode="word">
          {lines.join("\n")}
        </text>
      ),
      placeholder: "",
      onConfirm() {
        api.ui.dialog?.clear();
      },
      onCancel() {
        api.ui.dialog?.clear();
      },
    }),
  );
}
