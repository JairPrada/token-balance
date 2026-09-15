/**
 * Zen free model availability provider.
 *
 * Probes https://opencode.ai/zen/v1/chat/completions with each free model.
 */

import { resolveZenFreeKey } from "../auth/zen-key.js";

const ZEN_URL = "https://opencode.ai/zen/v1/chat/completions";

const FREE_MODELS = [
  "big-pickle",
  "deepseek-v4-flash-free",
  "muse-spark-1.3-contributor-free",
  "muse-spark-1.2-contributor-free",
  "mimo-v2.5-free",
  "ling-3.0-flash-fin-free",
  "nemotron-3-ultra-free",
  "nemotron-3.5-lightning-free",
];

export interface ModelStatus {
  model: string;
  status: "ok" | "rate-limited" | "error";
  retryAfterMs?: number;
}

export interface ZenFreeResult {
  available: boolean;
  models: ModelStatus[];
  error?: string;
}

async function probeModel(model: string, key: string): Promise<ModelStatus> {
  try {
    const res = await fetch(ZEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "." }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 200) {
      return { model, status: "ok" };
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0;
      return { model, status: "rate-limited", retryAfterMs };
    }

    // 400 MissingSessionID = model exists, available inside OpenCode
    if (res.status === 400) {
      const body = await res.text();
      if (body.includes("MissingSessionID")) {
        return { model, status: "ok" };
      }
    }

    return { model, status: "error" };
  } catch {
    return { model, status: "error" };
  }
}

export async function fetchZenFreeAvailability(): Promise<ZenFreeResult> {
  const key = await resolveZenFreeKey();
  if (!key) {
    return { available: false, models: [], error: "No API key configured" };
  }

  try {
    const results = await Promise.all(FREE_MODELS.map((model) => probeModel(model, key)));
    const anyAvailable = results.some((r) => r.status === "ok");

    return {
      available: anyAvailable,
      models: results,
    };
  } catch (err) {
    return {
      available: false,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
