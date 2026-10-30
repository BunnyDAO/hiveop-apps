/**
 * The window frame per platform. On a Mac the title bar is hidden and the
 * window buttons sit inside the site's own top bar (44px tall); the site makes
 * room for them when it sees the `inset-titlebar` capability (arena
 * lib/desktopChrome.ts). Windows and Linux keep their native frame for now.
 */
export interface WindowChrome {
  titleBarStyle?: 'hidden';
  trafficLightPosition?: { x: number; y: number };
}

export function windowChrome(platform: NodeJS.Platform): WindowChrome {
  if (platform !== 'darwin') return {};
  return { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 15 } };
}
