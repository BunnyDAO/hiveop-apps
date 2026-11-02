---
id: ph-05
title: Sign in with Apple on the website
type: AFK
status: done
blocked_by: []
parent: docs/prd/phone-apps.md
repo: Wenrwa-Marketplace + wenrwa-arena
---

## What to build

New backend provider: Apple web OAuth (Services ID, form_post callback, client secret JWT from the Apple key) and identity-token verification against Apple's JWKS. Account matching follows existing provider-linking rules; private-relay emails are real emails; Apple sends the name only on first sign-in, so store it then. Site sign-in panel gains "Continue with Apple". Config via env (Team ID, Key ID, key, Services ID); works with test keys locally. Owner creates the Services ID + key once the Apple account is approved.

Covers user stories 10, 14.

## Acceptance criteria

- [ ] Backend tests: token verification (valid, wrong audience, expired, bad signature) with a test JWKS; first sign-in creates an account with name; repeat sign-in finds it
- [ ] Site render test for the Apple button; returnTo stays on allowed origins
- [ ] Boot smoke with SKIP_MIGRATIONS=1
- [ ] GREEN = backend jest + arena vitest/lint:hooks/next build

## Blocked by

None — can start immediately

## Done (2026-11-02)

Backend bb987ea4 (Marketplace main), site 45cb2fc4 (arena master). Inert until the owner sets APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_PRIVATE_KEY (optional APPLE_EXTRA_AUDIENCES for the native bundle id) and registers `<BASE_URL>/api/v1/auth/oauth/apple/callback` as the Services ID return URL. Until then /auth/oauth/providers says apple:false and the button is hidden.
