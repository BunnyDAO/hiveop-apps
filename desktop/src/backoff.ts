const BASE_MS = 2000;
const CAP_MS = 30000;

/** Delay before retry number `attempt` (0-based): 2s, 4s, 8s ... capped at 30s. */
export function retryDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(BASE_MS * 2 ** Math.min(n, 10), CAP_MS);
}

const ERR_ABORTED = -3; // navigation superseded or cancelled (redirects, rapid clicks)

/** Should a did-fail-load event put up the "Can't reach HiveOp" page? */
export function isLoadFailure(code: number, isMainFrame: boolean, failedUrl: string, offlineUrl: string): boolean {
  if (!isMainFrame || code === ERR_ABORTED) return false;
  return !failedUrl.startsWith(offlineUrl.split('?')[0]);
}

/**
 * Did a did-finish-load mean the site really loaded? Chromium also fires it after a
 * failed load (for its own error page, still at the http URL), which must not cancel
 * the pending retry.
 */
export function isLoadSuccess(url: string, failedSinceStart: boolean): boolean {
  return !failedSinceStart && /^https?:/i.test(url);
}
