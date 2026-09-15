/**
 * OpenCode Go API key resolver.
 *
 * Priority: env OPENCODE_API_KEY → auth.json key "opencode-go" or "opencode"
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataDirs } from "../lib/runtime-paths.js";

const OPENCODE_GO_KEYS = ["opencode-go", "opencode"];

export async function resolveOpenCodeGoKey(): Promise<string | undefined> {
  // 1. Environment variable
  if (process.env.OPENCODE_API_KEY?.trim()) {
    return process.env.OPENCODE_API_KEY.trim();
  }

  // 2. auth.json
  for (const dir of getDataDirs()) {
    try {
      const content = await readFile(join(dir, "auth.json"), "utf-8");
      const auth = JSON.parse(content);
      for (const key of OPENCODE_GO_KEYS) {
        const entry = auth?.[key];
        if (entry?.key && typeof entry.key === "string" && entry.key.length > 0) {
          return entry.key.trim();
        }
      }
    } catch {
      // Try next
    }
  }

  return undefined;
}
