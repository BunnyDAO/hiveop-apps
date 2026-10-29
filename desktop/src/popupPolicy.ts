export type PopupAction = 'return' | 'stay' | 'block';

/**
 * What an app popup (Stripe, GitHub App install) does when it navigates to `rawUrl`.
 * Back on the site → hand the URL to the main window and close. Pure.
 */
export function popupAction(rawUrl: string, siteOrigin: string): PopupAction {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'block';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'block';
  return u.origin === siteOrigin ? 'return' : 'stay';
}
