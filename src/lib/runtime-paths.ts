/**
 * OpenCode runtime path resolution (xdg-basedir).
 * Supports Windows, macOS, and Linux.
 */

import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { xdgCache, xdgConfig, xdgData, xdgState } from "xdg-basedir";

export interface RuntimeDirs {
  dataDir: string;
  configDir: string;
  cacheDir: string;
  stateDir: string;
}

function dedupe(list: (string | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function getRuntimeDirs(params?: {
  env?: Record<string, string | undefined>;
  homeDir?: string;
  platform?: string;
}): RuntimeDirs {
  const env = params?.env ?? (process.env as Record<string, string | undefined>);
  const home = params?.homeDir ?? homedir();
  const platform = params?.platform ?? process.platform;

  const dataBase = env.XDG_DATA_HOME?.trim() || xdgData || join(home, ".local", "share");
  const configBase = env.XDG_CONFIG_HOME?.trim() || xdgConfig || join(home, ".config");
  const defaultConfigDir = join(configBase, "opencode");
  const configuredConfigDir = env.OPENCODE_CONFIG_DIR?.trim();
  const configDir = configuredConfigDir
    ? isAbsolute(configuredConfigDir)
      ? configuredConfigDir
      : resolve(defaultConfigDir, configuredConfigDir)
    : defaultConfigDir;
  const cacheBase = env.XDG_CACHE_HOME?.trim() || xdgCache || join(home, ".cache");
  const stateBase = env.XDG_STATE_HOME?.trim() || xdgState || join(home, ".local", "state");

  const dirs: RuntimeDirs = {
    dataDir: join(dataBase, "opencode"),
    configDir,
    cacheDir: join(cacheBase, "opencode"),
    stateDir: join(stateBase, "opencode"),
  };

  if (platform === "win32") {
    const appDataBase = env.APPDATA?.trim() || join(home, "AppData", "Roaming");
    const localAppDataBase = env.LOCALAPPDATA?.trim() || join(home, "AppData", "Local");
    dirs.dataDir = dedupe([dirs.dataDir, join(appDataBase, "opencode"), join(localAppDataBase, "opencode")])[0];
    dirs.configDir = dedupe([dirs.configDir, join(appDataBase, "opencode"), join(localAppDataBase, "opencode")])[0];
    dirs.cacheDir = dedupe([dirs.cacheDir, join(localAppDataBase, "opencode")])[0];
    dirs.stateDir = dedupe([dirs.stateDir, join(localAppDataBase, "opencode")])[0];
  } else if (platform === "darwin") {
    dirs.dataDir = dedupe([dirs.dataDir, join(home, ".local", "share", "opencode"), join(home, "Library", "Application Support", "opencode")])[0];
    dirs.configDir = dedupe([dirs.configDir, join(home, ".config", "opencode"), join(home, "Library", "Application Support", "opencode")])[0];
    dirs.cacheDir = dedupe([dirs.cacheDir, join(home, ".cache", "opencode"), join(home, "Library", "Caches", "opencode")])[0];
  }

  return dirs;
}

/** Get candidate data directories for reading auth files. */
export function getDataDirs(): string[] {
  const dirs = getRuntimeDirs();
  return dedupe([dirs.dataDir, join(homedir(), ".local", "share", "opencode")]);
}

/** Get candidate config directories for reading config files. */
export function getConfigDirs(): string[] {
  const dirs = getRuntimeDirs();
  return dedupe([dirs.configDir, join(homedir(), ".config", "opencode")]);
}
