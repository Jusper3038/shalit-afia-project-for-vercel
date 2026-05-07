const CACHE_TTL_MS = 60_000;
const QUERY_TIMEOUT_MS = 6000;

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

const cacheKey = (ownerId: string, key: string) => `clinic-cache:${ownerId}:${key}`;

export const readClinicCache = <T,>(ownerId: string | null, key: string): T | null => {
  if (!ownerId) return null;

  try {
    const raw = sessionStorage.getItem(cacheKey(ownerId, key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;

    return parsed.value;
  } catch {
    return null;
  }
};

export const writeClinicCache = <T,>(ownerId: string | null, key: string, value: T) => {
  if (!ownerId) return;

  try {
    sessionStorage.setItem(cacheKey(ownerId, key), JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Cache is best-effort only.
  }
};

export const withQueryTimeout = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallback), QUERY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};
