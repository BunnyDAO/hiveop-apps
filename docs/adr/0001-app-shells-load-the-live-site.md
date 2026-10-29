# 0001 — App shells load the live site; they never bundle it

Date: 2026-10-29 · Status: accepted

## Decision

The desktop app (and later the phone apps) is a thin native shell that loads https://app.hiveop.io. It ships no copy of the web app. Native features (native browser, managed bridge, menu bar, deep links, browser-bounce sign-in) are exposed to the site through one narrow, origin-checked bridge object; the site detects it and enables them. Everything else is the same code a browser tab runs.

## Why

The owner's requirement: one push updates browser and apps the same way. A bundled copy would need a shell release per site change and would drift.

## Trade-offs accepted

- No offline UI beyond a "Can't reach HiveOp — Retry" screen. Local agents keep running in the managed bridge while offline.
- The site must stay backward-compatible with every shell version in the wild: it feature-detects the shell's capabilities instead of assuming them.
- Remote content runs in a native app, so the shell is locked down: no Node in the page, a preload that exposes only the bridge object to the app.hiveop.io origin, and navigation outside allowed origins goes to the system browser.

## Alternatives rejected

- Bundled web build (Next.js static export inside the app): breaks "one deploy", and the site is server-rendered.
- PWA install only: the owner finds it lacking; no real browser, no managed bridge, no tray.
