/**
 * Auth.json reader — reads from ~/.local/share/opencode/auth.json
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDirs } from "../lib/runtime-paths.js";

export interface AuthData {
  [key: string]: {
    type?: string;
    key?: string;
  };
}

let authCache: { data: AuthData | null; timestamp: number } | null = null;
const CACHE_MAX_AGE_MS = 5_000;

function getAuthPaths(): string[] {
  return getDataDirs().map((d) => join(d, "auth.json"));
}

export async function readAuthFile(): Promise<AuthData | null> {
  const now = Date.now();
  if (authCache && now - authCache.timestamp <= CACHE_MAX_AGE_MS) {
    return authCache.data;
  }

  const paths = getAuthPaths();
  for (const path of paths) {
    try {
      const content = await readFile(path, "utf-8");
      const data = JSON.parse(content) as AuthData;
      authCache = { data, timestamp: now };
      return data;
    } catch {
      // Try next path
    }
  }

  authCache = { data: null, timestamp: now };
  return null;
}

export async function getApiKey(provider: string): Promise<string | undefined> {
  const auth = await readAuthFile();
  const entry = auth?.[provider];
  if (entry?.key && typeof entry.key === "string" && entry.key.length > 0) {
    return entry.key;
  }
  return undefined;
}
