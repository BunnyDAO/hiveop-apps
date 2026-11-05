---
id: ph-06
title: Sign in with Apple in the iPhone app
type: AFK
status: done
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

## Done (2026-11-04)

Marketplace 191e5a12 (main): `POST /auth/oauth/apple/native {identityToken, nonce(RAW), name?}`; audience must be in APPLE_EXTRA_AUDIENCES, nonce claim = sha256-hex(raw), JWKS/iss/exp as the web flow; account find/link/create extracted to `findOrCreateOAuthUser` (shared with the web callback); refuses a deleted account (401 ACCOUNT_DELETED) before any session; session minted like `/oauth/exchange`. Live on Railway (empty body -> 400). Arena 9c6ae9e8 (master, Vercel Ready): `phoneAppleSignIn()` (iOS + `apple-sign-in`), `appleNativeClient`, panel button uses the native sheet on iOS and the auth sheet bounce on Android. Shell 4797603 (hiveop-apps): `hiveopApp.appleSignIn()`, `AppleSignIn.swift` (ASAuthorization, hashed nonce, RAW nonce returned), `com.apple.developer.applesignin` entitlement merged beside ph-07's associated-domains; Android bounce accepts `apple`.

Verified: backend 15 new tests + existing auth/apple suites; arena tsc, vitest, lint:hooks, next build; mobile vitest 241, Android unit tests, Swift nonce check vs shared fixture, iOS simulator build (headless) succeeds.

Owner drill: Sign in with Apple capability on the io.hiveop.app App ID in the Apple developer account (else the sheet errors); simulator/device with a sandbox Apple ID lands signed in (first sign-in saves the name; private-relay email); a deleted account is refused; Android Apple button completes in the Custom Tab; iOS shell build with APPLE_EXTRA_AUDIENCES=io.hiveop.app on prod (already set).
