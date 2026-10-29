# HiveOp desktop app

Domain: **hiveop-apps** (new repo — app shells). Touches two other repos through narrow contracts: the site (wenrwa-arena → app.hiveop.io) and the backend + CLI (Wenrwa-Marketplace). See ADR-0001 and CONTEXT.md.

## Problem Statement

HiveOp lives in a browser tab. The owner finds that a worse experience than an app: the tab gets lost, "install as app" (PWA) feels lame, and the browser pane is a nested compromise — a plain frame that many sites refuse, an "open in new tab" fallback, or a streamed remote Chrome. Running local agents also means installing and starting the CLI bridge by hand (auto-start exists on Mac only) and keeping it updated by hand.

## Solution

A desktop app for Mac, Windows and Linux that shows the live HiveOp site in its own window, so a site deploy updates the browser and the app identically. On top of the site it adds what a tab can't: a real built-in browser in the browser pane, the local bridge run and updated by the app, a menu-bar / tray icon that keeps local agents alive with the window closed, `hiveop://` links, and Google sign-in that bounces through the system browser. The site detects the app and switches those features on; in a normal browser tab nothing changes.

## User Stories

1. As a HiveOp user, I want to download HiveOp for my OS from one Download page, so that I get the right installer without choosing.
2. As a user on a desktop browser, I want the old "Install app" banner replaced by "Get the HiveOp app", so that I learn the app exists; dismissing it is remembered.
3. As a user inside the app, I want no download banner, so that I'm not nagged to install what I'm using.
4. As a user, I want the app to open the same app.hiveop.io I use in the browser, so that every feature and fix arrives at the same time.
5. As a user, I want exactly one HiveOp window, so that terminals are never double-attached by stale windows.
6. As a user, I want reopening the app, clicking a `hiveop://` link, or clicking a desktop notification to focus that one window and navigate it, so that I never get a second window.
7. As a user, I want closing the window to leave a HiveOp icon in the menu bar / tray, so that my local agents keep working.
8. As a user, I want the tray menu to show Open HiveOp, how many local agents are running, bridge status, "Bridge update ready" when one is waiting, and Quit, so that I can see what's running without the window.
9. As a user, I want Quit to ask "Stop N local agents?" when any are running, so that I don't kill work by accident; with none running it quits at once.
10. As a user, I want the app to start at login (on by default, switchable in the tray), so that local agents are reachable after a reboot.
11. As a user whose internet or app.hiveop.io is down, I want a "Can't reach HiveOp — Retry" screen that retries on its own, so that I know what's wrong; local agents keep running meanwhile.
12. As a user, I want links in the browser pane to open in a real browser view — any web URL, team previews, local-workspace dev servers, and sites that refuse frames today — so that the pane behaves like a browser.
13. As a user on a cloud workspace, I want a link to the box's own localhost to keep using the streamed browser, unless a team preview URL exists, then open that in the real browser, so that box dev servers stay reachable.
14. As a user, I want back, forward, reload, the address bar, and tabs in the browser pane to work the same as today, so that nothing I know changes.
15. As a user, I want sites I sign into inside the built-in browser to stay signed in across restarts, so that it feels like my browser.
16. As a user, I want the built-in browser's logins kept separate from my HiveOp session, so that sites an agent opens can't read HiveOp's cookies.
17. As a user, I want HiveOp's menus, sheets and modals to draw over the built-in browser, so that nothing hides behind the pane.
18. As a user, I want an agent's `show_in_browser` / `refresh_browser` to open or reload the built-in browser like it does the pane today, so that agent-driven browsing keeps working.
19. As a developer, I want to open devtools for the built-in browser view, so that I can debug what my agent built.
20. As a user, I want downloads in the built-in browser saved to my Downloads folder, so that downloads just work.
21. As a user, I want "Continue with Google" to open my default browser, sign in there, show "You're signed in — back to HiveOp", and bring the app to the front signed in, so that Google sign-in works in the app.
22. As a user, I want email-code and GitHub sign-in to work inside the app as today, so that they need no detour.
23. As a user, I want Stripe checkout, the billing portal, GitHub App installs and GitHub repo connect to open in an app window and return me where I was, so that payments and repo setup work in the app.
24. As a user, I want links to unrelated sites clicked in the HiveOp UI (docs, a deployed app) to open in my system browser, so that the HiveOp window only shows HiveOp.
25. As a user who abandons Google sign-in in the system browser, I want the app's sign-in screen to stay usable and let me retry, so that I'm never stuck.
26. As a user with local workspaces and no bridge, I want the app to start a bridge for me, already paired to my signed-in account, so that I never paste a token.
27. As a user who already runs a CLI bridge, I want the app to use it and show a one-time "Let HiveOp manage your bridge?" banner, so that I'm in control.
28. As that user choosing Yes, I want the app to remove the CLI auto-start, wait until no local agent is mid-run, and restart the bridge under the app with agents resuming by session id, so that nothing is lost.
29. As that user choosing No, I want the CLI bridge left alone and never asked again, so that my setup isn't touched.
30. As a user, I want the managed bridge updated automatically: checked hourly, downloaded in the background, swapped in only when no local agent is running (or at next app start), so that I get fixes without interruptions.
31. As a user starting my first local agent without Claude Code installed, I want the app to fetch Anthropic's official Claude Code into its own folder ("Setting up Claude Code…") and then show the normal Anthropic login in the terminal, so that I install nothing myself.
32. As a user who already has Claude Code installed, I want the app to use mine, so that my version and login carry over.
33. As a user missing git, I want a clear pane message with how to get it (macOS: the system prompt to install developer tools), so that I know why local agents can't clone.
34. As a user, I want the app to tell me when a new app version exists ("Update available"); on Windows and Linux it installs on restart, on Mac it links the download until the app is signed, so that the shell stays current.
35. As a user or support, I want Help to show the app version and bridge version, so that problems can be diagnosed.
36. As the owner, I want installers built on this Mac (Linux and Windows in Docker) and published to GitHub Releases of a public hiveop-apps repo, so that releases cost nothing and need no CI.
37. As the owner, I want the app unsigned for now and signing added later without restructuring, so that we ship before the Apple/Windows accounts exist.

## Implementation Decisions

### Desktop shell (hiveop-apps/desktop, Electron)

- **Site connection** — one window loads app.hiveop.io (overridable by an env/flag for staging and localhost:3000 dev). No site code is bundled (ADR-0001).
- **Navigation policy** (deep, pure module) — `decide(url, context) → in-window | app-popup | system-browser | deny`. Allowed in-window: app.hiveop.io and the backend auth callback chain for GitHub/email. App-popup: Stripe checkout/portal, GitHub App install, GitHub OAuth authorize. Google OAuth: always system browser (browser bounce). Everything else from the HiveOp UI: system browser. Non-http(s) schemes denied except `hiveop:`.
- **Site bridge (preload)** — exposes one object, `window.hiveopDesktop`, only when the top frame's origin is the configured site: `{ version, capabilities[], browser.*, bridge.*, auth.*, app.* }`. contextIsolation on, nodeIntegration off, sandbox on. Every call validates arguments. The site feature-detects by `capabilities`, never by version, so old shells keep working (ADR-0001).
- **Window manager** — single-instance lock; second launch / `hiveop://` / notification → focus + navigate. Close → hide to tray (Mac: also keeps dock icon until Quit). "Can't reach HiveOp" screen is a local page shown on load failure, auto-retrying with backoff.
- **Tray** — menu items from user story 8; Quit confirmation from story 9; start-at-login toggle (OS login item, on by default).
- **Native browser host** — the browser pane renders an Electron `<webview>` (composited in the page, so HiveOp's overlays draw over it — no rect-mirroring). Shell hardens every attach (`will-attach-webview`): no preload, no node, persistent dedicated session partition (separate from HiveOp's session, persists across restarts), downloads to the Downloads folder, devtools allowed, popups from the view open as new pane tabs.
- **Bridge supervisor** (deep module, state machine) — states: `none → starting → running(managed) | running(cli) → updating → running`, plus `offered-takeover`, `declined`, `crashed(backoff)`. Detects an existing bridge via `GET 127.0.0.1:8377/discovery`. Runs the managed bridge with the app's own runtime (Electron as Node), from a CLI version stored in the app's data folder. Restarts on crash with backoff. Exposes state to the tray and the site.
- **Bridge installer** — fetches `@wenrwa/marketplace-cli` tarballs from the npm registry into app data, verifies the registry's sha512 integrity, unpacks to a versioned folder, swaps a `current` pointer atomically; keeps the previous version for rollback. Hourly check; swap only when the supervisor reports zero running local agents, else at next start.
- **Pairing** — the site, already signed in, asks the backend for a connect token for this device and hands it to `hiveopDesktop.bridge.pair(token)`; the shell stores it with OS-protected storage (Electron safeStorage) and passes it to the bridge. Never written to logs or plists.
- **Takeover** — if a CLI bridge is detected: shell reports `running(cli)`; site shows the one-time banner. Yes → remove `com.wenrwa.bridge` LaunchAgent (Mac; no CLI auto-start exists elsewhere), wait for zero running local agents, stop the CLI bridge, start the managed one. No → remembered in app data.
- **Login-shell environment** — resolve the user's login shell PATH once at start (GUI apps get a minimal PATH) and pass it to the bridge, with the app's own tools folder prepended.
- **Claude Code provisioner** — on first local agent, if `claude` is not on the resolved PATH, install Anthropic's official `@anthropic-ai/claude-code` npm package into the app's tools folder with the app runtime; report progress to the pane. If found, use the user's. Never bundled in the installer.
- **Shell updater** — checks GitHub Releases. Windows (NSIS) and Linux (AppImage) self-update via electron-updater (works unsigned). Mac: "Update available" + download link until signed.
- **Packaging** — electron-builder. Mac: universal dmg (arm64 + x64), unsigned. Windows: NSIS x64, built in an electron-builder Wine Docker image. Linux: AppImage + deb x64, built in Docker. `hiveop://` registered per OS. node-pty: prebuilt for darwin/win32 ships with node-pty; linux-x64 is compiled in the Linux Docker build and shipped in the app's tools folder for the bridge to use. Signing/notarization hooks left as config, off.
- **Identity** — user agent appends `HiveOpDesktop/<version>`; app id `io.hiveop.desktop`.

### Site (wenrwa-arena)

- **Desktop shell detection** (deep, pure) — one module reading `window.hiveopDesktop` and returning typed capabilities; every other site file asks it, nothing else touches the global.
- **Browser tier** — `browserTierFor` gains a `native` tier chosen when the shell has the `native-browser` capability: replaces `embed` and `external`. `container` stays for a cloud box's localhost unless a team preview URL exists for it. BrowserPane renders the webview for `native`; team previews do the existing `/__hiveop/enter?token=` navigation inside it.
- **Sign-in** — "Continue with Google" in the app calls `hiveopDesktop.auth.bounce()` instead of redirecting. New route `/desktop-return` (shown in the system browser): forwards the handoff to `hiveop://auth?...` and shows "You're signed in — back to HiveOp" with a manual "Open HiveOp" button.
- **Bridge UI** — when the shell has `managed-bridge`, the "Start your local Terminal Bridge" overlay is replaced by bridge state from the shell; takeover banner; Claude Code setup progress in the pane.
- **Banner + Download page** — on desktop browsers outside the app, InstallBanner becomes "Get the HiveOp app" → `/download` (signed-out reachable; detects OS; links the latest GitHub Release asset). Phones keep today's banner.
- **Help** — shows app + bridge versions when in the app.

### Backend + CLI (Wenrwa-Marketplace)

- **Browser-bounce handoff binding** — today a handoff token is redeemable by whoever holds it for 120s. Because another program could register `hiveop://` and intercept it, desktop sign-in binds the handoff to a challenge: the shell creates a random verifier, starts sign-in with its hash, and the exchange requires the verifier (PKCE-style). Without a challenge, today's behavior is unchanged. `returnTo` stays on an allowed origin (`app.hiveop.io/desktop-return`), so the origin allowlist does not change.
- **Device connect token** — an endpoint (or reuse of the existing Settings mint) the signed-in site can call to mint a connect token for "this device", for pairing.
- **CLI** — `/discovery` gains `version`; a `--managed` flag (or env) tells the bridge it is owned by the app (no pairing prompt, no npx fallback, logs where the app can show them).
- **Windows/Linux bridge** — the bridge has only run on Mac. The CLI must run local agents on Windows and Linux; gaps found there are fixed in the CLI (likely: shell selection, path handling, file permissions).

### Cross-repo contracts at risk
- `window.hiveopDesktop` shape (shell ↔ site) — versioned by capability strings.
- `/discovery` fields (bridge ↔ shell ↔ site) — additive only.
- Handoff exchange (backend ↔ site ↔ shell) — challenge optional, back-compatible.

## Testing Decisions

- Test external behavior through module interfaces; no tests of Electron internals.
- **Unit-tested deep modules:** navigation policy (table of URL → decision), bridge supervisor state machine (fake discovery + fake process), bridge installer (fake registry, integrity mismatch, interrupted swap, rollback), Claude Code provisioner (found / missing / install fails), site desktop-shell detection, `browserTierFor` with the `native` tier, `/desktop-return` forwarding, backend handoff challenge (with/without challenge, wrong verifier, expiry, reuse).
- **Smoke-tested by running:** the built Mac app on this machine (window, tray, bounce sign-in, native browser, managed bridge, takeover); Linux AppImage in Docker with a virtual display (starts, loads site, bridge runs); Windows installer build succeeds — Windows runtime cannot be tested here and is flagged in each release note until tested on a real machine.
- Prior art: arena vitest for lib modules (`lib/browserTier` tests), backend jest for auth routes, CLI tests for bridge modules; `verify-image.sh` style end-to-end checks for the packaged bridge.

## Out of Scope

- Phone apps (Capacitor) — next PRD, after the Apple/Google accounts and Xcode exist.
- Code signing, notarization, Windows certificate, Mac auto-install of shell updates — added when accounts exist.
- iOS payments decision.
- Push notifications on desktop beyond what the site already does with web notifications.
- Offline use of the site.
- More than one window.
- Bundling Claude Code or the site inside the installer.

## Further Notes

- Costs: none until signing (Apple $99/yr, Windows cert ~$200–400/yr) — owner's accounts.
- The public repo is created on GitHub only at the first release, with the owner's OK.
- Two-lane rule: the native browser serves local and cloud lanes; the cloud box's localhost keeps the streamed browser (story 13).
