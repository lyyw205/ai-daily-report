interface RetryOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async (
  url: string,
  options?: RequestInit,
  retryOptions: RetryOptions = {}
) => {
  const { timeoutMs = 8000, retries = 2, backoffMs = 500 } = retryOptions;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const message = `HTTP ${res.status} ${res.statusText}`.trim();
        if (res.status >= 500 || res.status === 429) {
          throw new Error(message);
        }
        return res;
      }

      return res;
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error('Unknown fetch error');

      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError ?? new Error('Fetch failed');
};
