/**
 * Zen free model API key resolver.
 *
 * Reads opencode.key from ~/.local/share/opencode/auth.json
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDirs } from "../lib/runtime-paths.js";

export async function resolveZenFreeKey(): Promise<string | undefined> {
  for (const dir of getDataDirs()) {
    try {
      const content = await readFile(join(dir, "auth.json"), "utf-8");
      const auth = JSON.parse(content);
      const key = auth?.opencode?.key;
      if (typeof key === "string" && key.length > 0) {
        return key.trim();
      }
    } catch {
      // Try next
    }
  }
  return undefined;
}
