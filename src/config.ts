/**
 * Configuration and authentication file resolution.
 *
 * Searches for config files across Linux, macOS, and Windows paths.
 * Supports OPENCODE_CONFIG_DIR env var for custom locations.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safeJson } from "./helpers.js";

const HOME = os.homedir();
const CFG_DIR = process.env.OPENCODE_CONFIG_DIR;

// ─── Types ───────────────────────────────────────────────────────────────

export interface AuthEntry {
  type?: string;
  key?: string;
}

export interface PluginConfig {
  providers?: {
    deepseek?: boolean;
    "opencode-go"?: boolean;
    "opencode-zen"?: boolean;
  };
  apiKeys?: {
    deepseek?: string;
    "opencode-go"?: string;
  };
  zen?: {
    workspaceId?: string;
    authCookie?: string;
  };
}

export interface OcProvider {
  apiKey?: string;
  options?: { apiKey?: string };
}

export interface OpencodeConfig {
  provider?: Record<string, OcProvider>;
  providers?: Record<string, OcProvider>;
}

// ─── Path Resolution ─────────────────────────────────────────────────────

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

/** Backwards compat: old opencode-quota plugin config */
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
  for (const f of paths) {
    const v = safeJson<T>(f);
    if (v) return v;
  }
  return undefined;
}

// ─── Public Read Functions ───────────────────────────────────────────────

export function readAuth(): Record<string, AuthEntry> | undefined {
  return readFirst<Record<string, AuthEntry>>(getAuthPaths());
}

export function readPluginConfig(): PluginConfig {
  const cfg = readFirst<PluginConfig>(getPluginConfigPaths());
  if (cfg?.zen?.workspaceId && cfg?.zen?.authCookie) return cfg;

  // Fallback: old opencode-quota config (flat structure)
  const old = readFirst<{ workspaceId?: string; authCookie?: string }>(getOldZenConfigPaths());
  if (old?.workspaceId && old?.authCookie) {
    return { ...cfg, zen: { workspaceId: old.workspaceId, authCookie: old.authCookie } };
  }

  return cfg ?? {};
}

export function readOpencodeConfig(): OpencodeConfig | undefined {
  return readFirst<OpencodeConfig>(getOpencodeConfigPaths());
}

// ─── Config Directory & Write ────────────────────────────────────────────

function getConfigDir(): string {
  if (CFG_DIR) return CFG_DIR;
  const platform = os.platform();
  if (platform === "darwin") return path.join(HOME, "Library", "Application Support", "opencode");
  if (platform === "win32") return path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "opencode");
  return path.join(HOME, ".config", "opencode");
}

export function writePluginConfig(cfg: PluginConfig): void {
  const dir = path.join(getConfigDir(), "token-balance");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(cfg, null, 2), "utf8");
}
