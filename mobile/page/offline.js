
const msg = document.getElementById('msg');

async function probe() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    // no-cors: any answer from the server resolves; only a network failure rejects.
    await fetch(SITE_URL, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

const retrier = createRetrier({
  probe,
  onReachable: () => location.replace(SITE_URL),
});

document.getElementById('retry').addEventListener('click', () => {
  msg.textContent = 'Trying…';
  retrier.tryNow();
});
window.addEventListener('online', () => retrier.networkChanged());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') retrier.tryNow();
});
setInterval(() => {
  msg.textContent = 'Check your connection. Retrying automatically.';
}, 4000);
retrier.start();
