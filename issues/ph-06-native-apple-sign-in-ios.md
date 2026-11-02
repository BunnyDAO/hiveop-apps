---
id: ph-06
title: Sign in with Apple in the iPhone app
type: AFK
status: open
blocked_by: [ph-01, ph-02, ph-05]
parent: docs/prd/phone-apps.md
repo: hiveop-apps + wenrwa-arena + Wenrwa-Marketplace
---

## What to build

On iOS the Apple button uses the native sheet (Face ID). The shell returns the identity token + nonce; the site posts it to a backend native endpoint that verifies it (audience = bundle id) and signs in. Android uses the web flow from ph-05 through the auth sheet. Capability `apple-sign-in`.

Covers user stories 9.

## Acceptance criteria

- [ ] Backend test for native endpoint (audience bundle id, nonce check)
- [ ] Simulator: Apple sign-in with a sandbox Apple ID lands signed in
- [ ] Android: Apple button runs the web flow in the auth sheet and returns signed in

## Blocked by

- ph-01
- ph-02
- ph-05
