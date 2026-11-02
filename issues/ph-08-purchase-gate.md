---
id: ph-08
title: Buying follows the store rules (US link-out, hidden elsewhere)
type: AFK
status: open
blocked_by: [ph-01, ph-02]
parent: docs/prd/phone-apps.md
repo: wenrwa-arena + hiveop-apps
---

## What to build

Shell: a small native storefront plugin returns the store country (iOS StoreKit storefront; Android Play Billing config); unknown = non-US. Capability `storefront`. Site: pure `purchaseMode(shell, storefront) → 'buy' | 'link-out' | 'hidden'`. Every buy, upgrade, plan pick, credit pack and paywall CTA goes through it. link-out opens checkout in the system browser; hidden removes the CTA and any mention of buying on the web. USDC packs hidden in phone apps always. Balances and plan names still show.

Covers user stories 26–28.

## Acceptance criteria

- [ ] purchaseMode tests for every shell × storefront
- [ ] Guard: rendering subscribe, credits, plans, billing and paywall prompts with a phone-app non-US shell shows no purchase CTA (render-based, not source grep)
- [ ] US phone-app: Buy opens the system browser at checkout
- [ ] Browser and desktop behaviour unchanged (existing tests green)

## Blocked by

- ph-01
- ph-02
