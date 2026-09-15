/**
 * DeepSeek balance provider.
 *
 * GET https://api.deepseek.com/user/balance
 */

import { resolveDeepSeekKey } from "../auth/deepseek.js";
import { fetchWithTimeout } from "../lib/http.js";

const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";

export interface DeepSeekBalance {
  currency: string;
  totalBalance?: string;
  grantedBalance?: string;
  toppedUpBalance?: string;
}

export interface DeepSeekResult {
  available: boolean;
  balances: DeepSeekBalance[];
  error?: string;
}

export async function fetchDeepSeekBalance(): Promise<DeepSeekResult> {
  const key = await resolveDeepSeekKey();
  if (!key) {
    return { available: false, balances: [], error: "No API key configured" };
  }

  try {
    const result = await fetchWithTimeout(DEEPSEEK_BALANCE_URL, {
      request: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "User-Agent": "token-balance/1.0",
        },
      },
      consume: async (response) => {
        if (!response.ok) {
          return { available: false, balances: [], error: `API error ${response.status}` };
        }
        const payload = await response.json() as Record<string, unknown>;
        const balanceInfos = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
        const balances: DeepSeekBalance[] = [];

        for (const info of balanceInfos) {
          if (typeof info !== "object" || info === null) continue;
          const r = info as Record<string, unknown>;
          const currency = typeof r.currency === "string" ? r.currency.toUpperCase() : "";
          if (!currency || !["CNY", "USD"].includes(currency)) continue;

          balances.push({
            currency,
            totalBalance: typeof r.total_balance === "string" ? r.total_balance : undefined,
            grantedBalance: typeof r.granted_balance === "string" ? r.granted_balance : undefined,
            toppedUpBalance: typeof r.topped_up_balance === "string" ? r.topped_up_balance : undefined,
          });
        }

        return { available: true, balances };
      },
    });

    return result;
  } catch (err) {
    return {
      available: false,
      balances: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
