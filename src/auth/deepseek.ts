/**
 * DeepSeek API key resolver.
 *
 * Priority: env DEEPSEEK_API_KEY → opencode.json provider config → auth.json
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDirs, getDataDirs } from "../lib/runtime-paths.js";

export async function resolveDeepSeekKey(): Promise<string | undefined> {
  // 1. Environment variable
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    return process.env.DEEPSEEK_API_KEY.trim();
  }

  // 2. opencode.json provider config
  for (const dir of getConfigDirs()) {
    for (const name of ["opencode.json", "opencode.jsonc"]) {
      try {
        const content = await readFile(join(dir, name), "utf-8");
        const config = JSON.parse(content);
        const key = config?.provider?.deepseek?.apiKey;
        if (typeof key === "string" && key.length > 0 && !key.startsWith("{env:")) {
          return key.trim();
        }
      } catch {
        // Try next
      }
    }
  }

  // 3. auth.json
  for (const dir of getDataDirs()) {
    try {
      const content = await readFile(join(dir, "auth.json"), "utf-8");
      const auth = JSON.parse(content);
      const key = auth?.deepseek?.key;
      if (typeof key === "string" && key.length > 0) {
        return key.trim();
      }
    } catch {
      // Try next
    }
  }

  return undefined;
}
