---
id: dsk-02
title: handoff bound to a challenge
type: AFK
status: done
blocked_by: []
parent: docs/prd/desktop-app.md
repo: Wenrwa-Marketplace (backend)
---

## What to build

PKCE-style binding for the OAuth handoff. Starting Google sign-in may carry a challenge (hash of a random verifier) and a desktop return (`app.hiveop.io/desktop-return`, an already-allowed origin). The handoff token issued for that flow can only be exchanged with the matching verifier. Without a challenge, today's behavior is unchanged. Story 21.

## Acceptance criteria

- [ ] Handoff minted with a challenge: exchange without verifier → refused; wrong verifier → refused; right verifier → session cookies set
- [ ] Handoff without a challenge exchanges exactly as before (existing tests stay green)
- [ ] Single-use and 120s expiry still hold for challenged tokens
- [ ] Challenge stored server-side with the handoff, never in the redirect URL in clear verifier form
- [ ] GREEN = backend jest for auth routes + tsc; boot smoke with SKIP_MIGRATIONS=1 if server wiring changes

## Blocked by

None — can start immediately
