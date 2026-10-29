---
id: dsk-09
title: google browser bounce
type: AFK
status: done
blocked_by: [dsk-02, dsk-04, dsk-05]
parent: docs/prd/desktop-app.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Capability `auth-bounce`. In the app, Continue with Google calls the shell, which creates a verifier, opens the system browser at the Google start URL with the challenge and desktop return. New site route `/desktop-return` (in the system browser) forwards to `hiveop://auth?handoff=…` and shows "You're signed in — back to HiveOp" with an Open HiveOp button. The shell receives the deep link, focuses the window and has the site exchange the handoff with the verifier. Abandoning leaves the sign-in screen usable. Stories 21, 25.

## Acceptance criteria

- [ ] Google sign-in in the app ends with the app signed in and focused
- [ ] A handoff delivered to hiveop:// without the app's verifier fails to sign in
- [ ] Closing the browser tab mid-flow: the app's sign-in screen still works and retry works
- [ ] In a normal browser Google sign-in is unchanged
- [ ] GREEN = arena gate + /desktop-return tests + manual run on prod

## Blocked by

- dsk-02
- dsk-04
- dsk-05
