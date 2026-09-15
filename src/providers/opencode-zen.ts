/**
 * OpenCode Zen billing provider.
 *
 * Scrapes https://opencode.ai/workspace/{id}/billing for balance data.
 */

import { resolveZenConfig } from "../auth/opencode-zen.js";
import { fetchWithTimeout } from "../lib/http.js";

const BILLING_URL_PREFIX = "https://opencode.ai/workspace/";
const BILLING_URL_SUFFIX = "/billing";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/148.0";
const BILLING_UNITS_PER_DOLLAR = 100_000_000;

export interface ZenBilling {
  balanceUsd: number;
  monthlyLimitUsd: number | null;
  monthlyUsageUsd: number | null;
  reload: boolean;
}

export interface ZenBillingResult {
  available: boolean;
  billing?: ZenBilling;
  error?: string;
}

function parseSsrBillingData(html: string): ZenBilling | null {
  const fields: Record<string, number> = {};
  const re = /\b(balance|monthlyLimit|monthlyUsage)\s*:\s*(\d+(?:\.\d+)?)\b/g;
  for (const match of html.matchAll(re)) {
    fields[match[1]] = Number(match[2]);
  }
  if (!Number.isFinite(fields.balance) || fields.balance < 0) return null;

  return {
    balanceUsd: fields.balance / BILLING_UNITS_PER_DOLLAR,
    monthlyLimitUsd: Number.isFinite(fields.monthlyLimit) && fields.monthlyLimit >= 0
      ? fields.monthlyLimit
      : null,
    monthlyUsageUsd: Number.isFinite(fields.monthlyUsage) && fields.monthlyUsage >= 0
      ? fields.monthlyUsage / BILLING_UNITS_PER_DOLLAR
      : null,
    reload: /reload\s*:\s*(true|!0)/.test(html),
  };
}

function parseNewSsrBillingData(html: string): ZenBilling | null {
  const match = /billing\.get[^\[]*\[\s*\\?"[^"]+\\?"\]\s*=\s*\$R\[\d+\]=\$R\[\d+\]\(\$R\[(\d+)\]/.exec(html);
  if (!match) return null;

  const start = match.index + match[0].length;
  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      if (depth === 0) { end = i + 1; break; }
      depth--;
    }
  }
  const objStr = html.slice(start, end);

  const balanceMatch = objStr.match(/\bbalance\s*:\s*(-?\d+)/);
  const limitMatch = objStr.match(/\bmonthlyLimit\s*:\s*(\d+)/);
  const usageMatch = objStr.match(/\bmonthlyUsage\s*:\s*(\d+)/);
  const reloadMatch = objStr.match(/\breload\s*:\s*(true|!0)/);

  if (!balanceMatch) return null;

  return {
    balanceUsd: Math.max(0, Number(balanceMatch[1])) / BILLING_UNITS_PER_DOLLAR,
    monthlyLimitUsd: limitMatch ? Number(limitMatch[1]) : null,
    monthlyUsageUsd: usageMatch ? Number(usageMatch[1]) / BILLING_UNITS_PER_DOLLAR : null,
    reload: reloadMatch ? true : false,
  };
}

function parseDataSlotBillingData(html: string): ZenBilling | null {
  let balance: number | null = null;
  let monthlyLimit: number | null = null;
  let monthlyUsage: number | null = null;
  const items = html.split(/data-slot="billing-item"/);

  for (let index = 1; index < items.length; index++) {
    const content = items[index];
    const labelMatch = content.match(/data-slot="billing-label">([^<]+)</);
    const valueMatch = content.match(/data-slot="billing-value">[^$]*\$?(\d+(?:,\d{3})*(?:\.\d+)?)/);
    if (!labelMatch || !valueMatch) continue;

    const dollarAmount = Number.parseFloat(valueMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(dollarAmount) || dollarAmount < 0) continue;

    const label = labelMatch[1].trim().toLowerCase();
    if (label.includes("balance")) {
      balance = dollarAmount * BILLING_UNITS_PER_DOLLAR;
    } else if (label.includes("monthly") && label.includes("limit")) {
      monthlyLimit = dollarAmount;
    } else if (label.includes("monthly") && label.includes("usage")) {
      monthlyUsage = dollarAmount * BILLING_UNITS_PER_DOLLAR;
    }
  }

  if (balance === null) return null;
  return {
    balanceUsd: balance / BILLING_UNITS_PER_DOLLAR,
    monthlyLimitUsd: monthlyLimit,
    monthlyUsageUsd: monthlyUsage !== null ? monthlyUsage / BILLING_UNITS_PER_DOLLAR : null,
    reload: false,
  };
}

export async function fetchOpenCodeZenBilling(): Promise<ZenBillingResult> {
  const config = await resolveZenConfig();
  if (!config) {
    return { available: false, error: "No Zen config (workspaceId/authCookie)" };
  }

  try {
    const url = `${BILLING_URL_PREFIX}${encodeURIComponent(config.workspaceId)}${BILLING_URL_SUFFIX}`;
    return await fetchWithTimeout(url, {
      request: {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
          Cookie: `auth=${config.authCookie}`,
        },
      },
      timeoutMs: 10_000,
      consume: async (response) => {
        if (!response.ok) {
          return { available: false, error: `Billing error ${response.status}` };
        }
        const html = await response.text();
        const billing = parseNewSsrBillingData(html) ?? parseSsrBillingData(html) ?? parseDataSlotBillingData(html);

        if (!billing) {
          return { available: false, error: "Could not parse billing data" };
        }

        return { available: true, billing };
      },
    });
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
