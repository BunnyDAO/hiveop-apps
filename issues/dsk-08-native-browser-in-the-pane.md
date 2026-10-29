---
id: dsk-08
title: native browser in the pane
type: AFK
status: open
blocked_by: [dsk-04]
parent: docs/prd/desktop-app.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Capability `native-browser`. `browserTierFor` gains a `native` tier that replaces `embed` and `external` in the app; `container` stays for a cloud box's localhost unless a team preview URL exists, which opens natively (with the existing enter-token navigation). BrowserPane renders a `<webview>` for `native` with URL bar, back/forward/reload, tabs as today. Shell hardens every attach: no preload/node, dedicated persistent partition separate from HiveOp's session, downloads to Downloads, devtools allowed, popups become pane tabs. `show_in_browser`/`refresh_browser` drive it. HiveOp overlays draw over it. Stories 12–20.

## Acceptance criteria

- [ ] In the app, a frame-refusing site (e.g. github.com) loads in the pane
- [ ] Local dev server URL loads natively; cloud box localhost still streams; with a team preview it loads natively
- [ ] Agent show_in_browser opens/reloads the native view
- [ ] A HiveOp sheet opened over the pane is visible on top
- [ ] Signed into a site in the pane survives an app restart; HiveOp cookies are not visible to it
- [ ] In a normal browser tab nothing changes (tier tests)
- [ ] GREEN = arena gate (tsc+eslint+vitest+next build) + shell tests + manual run

## Blocked by

- dsk-04
