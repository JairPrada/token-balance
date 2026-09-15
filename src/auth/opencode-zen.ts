/**
 * OpenCode Zen config resolver.
 *
 * Reads workspaceId + authCookie from ~/.config/opencode/opencode-quota/opencode.json
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDirs } from "../lib/runtime-paths.js";

export interface ZenConfig {
  workspaceId: string;
  authCookie: string;
}

export async function resolveZenConfig(): Promise<ZenConfig | undefined> {
  for (const dir of getConfigDirs()) {
    try {
      const content = await readFile(join(dir, "opencode-quota", "opencode.json"), "utf-8");
      const config = JSON.parse(content);
      const workspaceId = typeof config?.workspaceId === "string" ? config.workspaceId.trim() : "";
      const authCookie = typeof config?.authCookie === "string" ? config.authCookie.trim() : "";
      if (workspaceId && authCookie) {
        return { workspaceId, authCookie };
      }
    } catch {
      // Try next
    }
  }
  return undefined;
}
