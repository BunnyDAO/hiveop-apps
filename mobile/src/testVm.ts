import { runInNewContext } from 'node:vm';

/** Runs a page script in a bare context whose window.location.origin is `origin`. Test helper. */
export function vm(script: string, origin: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const window: Record<string, unknown> = { location: { origin }, ...extra };
  window.window = window;
  runInNewContext(script, window);
  return window;
}
