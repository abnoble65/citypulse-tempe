/**
 * utils/fetchWithTimeout.ts — CityPulse web
 *
 * Wraps the native fetch API with an AbortController-based timeout.
 * When the timeout fires the request is actually cancelled (not just ignored).
 */

/** Default timeouts (ms) */
export const TIMEOUT_DATA = 15_000;   // DataSF / Supabase REST
export const TIMEOUT_AI   = 60_000;   // Anthropic Claude generation

export class FetchTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Request timed out after ${(ms / 1000).toFixed(0)}s: ${url}`);
    this.name = "FetchTimeoutError";
  }
}

/**
 * fetch() wrapper that aborts after `timeoutMs` milliseconds.
 *
 * Accepts an optional external AbortSignal (e.g. from navigation).
 * If the external signal fires first, it takes priority over the timeout.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number; signal?: AbortSignal },
): Promise<Response> {
  const { timeoutMs = TIMEOUT_DATA, signal: externalSignal, ...rest } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller provided an external signal, forward its abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => {
        clearTimeout(timer);
        controller.abort();
      }, { once: true });
    }
  }

  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

  return fetch(input, { ...rest, signal: controller.signal })
    .catch((err) => {
      if (err?.name === "AbortError") {
        // Distinguish timeout vs external abort
        if (externalSignal?.aborted) throw err; // re-throw as-is for navigation abort
        throw new FetchTimeoutError(url, timeoutMs);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

/**
 * Wraps any promise with a timeout. Useful for non-fetch async operations
 * (e.g. Anthropic SDK calls that manage their own HTTP).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new FetchTimeoutError(label, ms)),
      ms,
    );
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}
