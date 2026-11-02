---
id: ph-12
title: Delete account screen (site and apps)
type: AFK
status: open
blocked_by: [ph-11]
parent: docs/prd/phone-apps.md
repo: wenrwa-arena
---

## What to build

You → Settings → Delete account on phone and desktop layouts. Shows the server preview: solo workspaces that go, shared workspaces with the member who inherits each, credits lost, plan cancelled, "won't be refunded" line matching the Terms. Type DELETE to enable the red button. Blocked-for-balance state links to pay. After success: signed out, lands on a short "Your account is deleted" page.

Covers user stories 29, 32.

## Acceptance criteria

- [ ] Render tests for preview, blocked, typing gate, success
- [ ] Works in the phone layout at 320–430px with no horizontal scroll; nothing under 12px
- [ ] GREEN = arena vitest + lint:hooks + next build + audit:ui

## Blocked by

- ph-11
