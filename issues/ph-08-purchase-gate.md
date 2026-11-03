---
id: ph-08
title: Buying follows the store rules (US link-out, hidden elsewhere)
type: AFK
status: done
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

## Done (2026-11-02)

Shell e252da3, site 5f39b473. purchaseMode gates 19 surfaces (81 render tests); first paint is the phone-safe answer, browsers switch to buy after mount. Link-out → https://hiveop.io/?from=app#pricing in the system browser. Android adds Play Billing 7.1.1 (BILLING permission) for the country read only. Judgement calls: spend-cap raises ungated; delete-account Pay now hidden outside US; header billing button dropped in link-out. Owner drill: real storefront on Play/App Store devices; link-out review in US.
