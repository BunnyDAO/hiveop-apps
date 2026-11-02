---
id: ph-09
title: Notifications on the server: devices and the needs-you notifier
type: AFK
status: done
blocked_by: []
parent: docs/prd/phone-apps.md
repo: Wenrwa-Marketplace
---

## What to build

Push devices table (user, platform, token, app version, timestamps) with register/unregister endpoints (auth required; a token moves to the newest user that registers it). Needs-you notifier (deep module): `onNeedsYou(item)` resolves recipients, skips users whose switch is off, dedupes per item (an item buzzes once), builds `{title, body, path, badge}` with badge = that user's needs-you count, and sends via an APNs (token key) or FCM HTTP v1 sender behind one interface. Dead tokens reported by APNs/FCM are deleted. Hooked where needs-you items are created (crew-run proposals, human gates / agent questions). The needs-you rule is pinned to the site's count by a parity test. Senders no-op without credentials (so it ships before the owner creates keys).

Covers user stories 17, 19, 22–24.

## Acceptance criteria

- [ ] Notifier unit tests: recipients, switch off, dedupe, badge count, path per item type
- [ ] Integration: register → item created → one send per device; dead token pruned
- [ ] Parity test: backend needs-you set equals the site's needsYouCount rules for shared fixtures
- [ ] Boot smoke with SKIP_MIGRATIONS=1; migration additive

## Blocked by

None — can start immediately

## Done (2026-11-02)

Marketplace c93d235c + fb6a8570 (re-pinned to the site's current needs-you kinds: crew-proposal and spend-cap-pause behind LAUNCH_CREWS=1, plus agent-attn via a 2-minute stall sweep); arena parity fixture cbee0bfb. Endpoints: POST/DELETE /push/devices, GET/PUT /push/preferences. Senders no-op until APNS_KEY_ID/APNS_TEAM_ID/APNS_KEY_P8 (+APNS_ENV) and FCM_SERVICE_ACCOUNT_JSON are set. Known gaps: site-side stall acks (localStorage) aren't visible to the server, so the phone badge can run higher; spend-cap pauses count 0 server-side; the two fixture copies must be kept identical by hand.
