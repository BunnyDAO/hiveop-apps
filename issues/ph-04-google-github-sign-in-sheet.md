---
id: ph-04
title: Google and GitHub sign-in through the secure sheet
type: AFK
status: open
blocked_by: [ph-01, ph-02]
parent: docs/prd/phone-apps.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

In the phone app, Continue with Google/GitHub uses the browser bounce: the shell creates the PKCE verifier, opens ASWebAuthenticationSession (iOS) / Custom Tabs (Android) at the backend OAuth start with the challenge and `returnTo=…/desktop-return`; `/desktop-return` forwards to `hiveop://auth?handoff=…`; the session closes and the shell has the site exchange the handoff with its verifier. Capability `auth-bounce`. No backend change (desktop already shipped the challenge binding). Email code keeps working in the web view.

Covers user stories 11–12.

## Acceptance criteria

- [ ] Unit tests for the shell's auth return parsing (reuse desktop deepLink rules)
- [ ] Emulator: Google sign-in (test account) returns to the app signed in; cancel returns to the sign-in screen with no error toast
- [ ] A handoff without the matching verifier is refused (existing backend test still green)
- [ ] Email code sign-in works in the app

## Blocked by

- ph-01
- ph-02
