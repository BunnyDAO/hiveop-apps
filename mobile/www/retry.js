// Retry scheduling for the "Can't reach HiveOp" page. Plain ES module, no dependencies,
// so the page loads it as-is and vitest tests it directly.
const BASE_MS = 2000;
const CAP_MS = 30000;

/** Delay before retry number `attempt` (0-based): 2s, 4s, 8s ... capped at 30s. */
export function retryDelayMs(attempt) {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(BASE_MS * 2 ** Math.min(n, 10), CAP_MS);
}

/**
 * probe() -> Promise<boolean> says whether the site answers. onReachable() fires once when
 * it does (the page then navigates to the site). The timer functions are injectable.
 */
export function createRetrier({ probe, onReachable, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let attempt = 0;
  let timer = null;
  let nextMs = 0;
  let done = false;
  let probing = false;

  function schedule() {
    clearTimer(timer);
    nextMs = retryDelayMs(attempt);
    timer = setTimer(run, nextMs);
  }

  async function run() {
    if (done || probing) return;
    probing = true;
    let ok = false;
    try {
      ok = await probe();
    } catch {
      ok = false;
    }
    probing = false;
    if (done) return;
    if (ok) {
      done = true;
      clearTimer(timer);
      onReachable();
      return;
    }
    attempt += 1;
    schedule();
  }

  return {
    start: schedule,
    /** Try again button, or the app coming back to the foreground. */
    tryNow() {
      clearTimer(timer);
      void run();
    },
    /** The OS reports the network changed: probe now and restart the backoff. */
    networkChanged() {
      attempt = -1; // the failed probe below counts as attempt 0, so the next wait is 2s
      clearTimer(timer);
      void run();
    },
    nextInMs: () => nextMs,
  };
}
