---
id: ph-09
title: Notifications on the server: devices and the needs-you notifier
type: AFK
status: open
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
