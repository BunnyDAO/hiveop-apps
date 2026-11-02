# 0002 — Phone apps sell nothing in-app; US storefront links out to the web

Date: 2026-11-01 · Status: accepted

## Decision

The iOS and Android apps do not use Apple In-App Purchase or Google Play Billing. In the US storefront they show a store link-out ("buy on hiveop.io") that opens checkout in the system browser. In every other storefront they show plan and credit balances but no purchase buttons, and do not mention buying on the web. The site decides which by asking the shell for the storefront country; an unknown country is treated as non-US.

## Why

Credits and plans are digital goods. Store billing takes a 15% cut (small-business rate), which under the "never at a loss" rule would force ~18% higher in-app prices plus server-side receipt validation for both stores. Since the 2025 US rulings, apps may link out to web checkout in the US storefront with no commission. The owner chose that and accepted no in-app buying elsewhere (2026-11-01).

## Trade-offs accepted

- Non-US phone users buy on the web without being told so in the app.
- App Review may still object; the fallback is adding store billing for credit packs only (a separate PRD).
- Store policy here moves fast; re-check the US link-out rules for both stores before each submission.

## Alternatives rejected

- Store billing (IAP / Play Billing) at launch: margin hit and a large server build for unproven demand.
- No purchase anywhere, US included: gives up the one channel that is free and allowed.
