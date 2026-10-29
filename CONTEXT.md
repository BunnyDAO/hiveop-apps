# HiveOp apps — glossary

**App shell** — the native program (desktop now, phone later) that shows the live HiveOp site. It carries no copy of the site; a site deploy changes what every shell shows.

**Desktop app** — the app shell for Mac, Windows and Linux. Exactly one HiveOp window, plus a menu-bar / tray icon that outlives the window.

**Site** — app.hiveop.io, the same web app a browser tab shows. The shell never forks it.

**Native browser** — a real browser view inside the desktop app's browser pane. Replaces the plain frame and the "open in new tab" fallback. Not the **streamed browser**.

**Streamed browser** — the remote Chrome running next to a cloud workspace's box, streamed into the pane. Still used for the box's own localhost when no team preview URL exists.

**Managed bridge** — the local bridge when the desktop app runs and updates it. Same bridge as the CLI one; only the owner differs.

**CLI bridge** — a local bridge the user started themselves (npx or the auto-start plist). The desktop app can offer to take it over.

**Bridge update** — a newer bridge version swapped in by the desktop app while no local agent is running. Separate from a **shell update**.

**Shell update** — a new release of the app shell itself. Rare; the site updates without one.

**Browser bounce** — sign-in that leaves the app for the system browser (Google) and returns to the app signed in.
