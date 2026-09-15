/**
 * HTTP utilities with timeout support.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchWithTimeout<T>(
  url: string,
  options: {
    request?: RequestInit;
    timeoutMs?: number;
    consume: (response: Response, signal: AbortSignal) => Promise<T>;
  },
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });

  try {
    const transaction = (async () => {
      const response = await fetch(url, {
        ...options.request,
        signal: controller.signal,
      });
      return await options.consume(response, controller.signal);
    })();

    return await Promise.race([transaction, timeout]);
  } catch (err) {
    if (timedOut) throw new Error(`Request timeout after ${Math.round(timeoutMs / 1000)}s`);
    throw err;
  }
}
