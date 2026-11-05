# US link-out rules, researched 2026-11-04

Re-check again the day before submission (issue ph-14 says so). Rules here move by court order. What HiveOp does today (ph-08): in a phone app with a US storefront, a "Buy on hiveop.io" control opens `https://hiveop.io/?from=app#pricing` in the system browser; every other storefront shows no purchase CTA and no text about buying on the web (`wenrwa-arena/lib/purchaseMode.ts`).

## Apple (iOS, US storefront)

Findings
- Guideline 3.1.1(a): entitlements are NOT required "to include buttons, external links, or other calls to action in their United States storefront apps." Outside the US, external purchase CTAs in the app or its metadata remain banned. Same carve-out in 3.1.3 and 3.1.3(a). Source: https://developer.apple.com/app-store/review/guidelines/ (page shows no version date; Apple's news feed lists a guidelines update 2026-10-16 that did not change 3.1.1(a): https://developer.apple.com/news/).
- 3.1.1 still bans crypto/wallets as an unlock mechanism. Not relevant: parked.
- Legal state: Ninth Circuit (Dec 2025) upheld the injunction but ruled a total ban on commission for linked-out purchases was overbroad; Apple may charge a fee for costs genuinely and reasonably necessary, rate remanded; Apple may stop developer links from being more prominent than its own IAP links. Apple petitioned the Supreme Court on 2026-05-21; on 2026-08-13 the Supreme Court denied Apple's request to pause the rate proceedings and Apple proposed 15% standard / 5% Small Business / 10% some programs; Epic has not accepted; no ruling date. Sources: https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple , https://9to5mac.com/2026/08/13/apple-proposes-commissions-of-up-to-15-for-off-app-store-purchases-in-the-us/ , https://appleinsider.com/articles/26/08/13/apples-latest-commission-rates-for-external-app-store-purchases-havent-satisfied-epic
- Unsettled: reports conflict on whether Apple is charging any commission today (one says 27% pending the rate fight, another says 0% since the April 2025 violation order). Treat as an open commercial question for the owner, not a review blocker.

What ph-08 must do for Apple
1. Show the link only when the App Store storefront is `US` (done: `purchaseMode`). Unknown or pending = hidden (done).
2. Keep the CTA no more prominent than any Apple in-app purchase option. We have none, so no issue; if IAP is ever added (ADR-0002 fallback) re-check prominence.
3. Open the system browser or a sheet; no deceptive wording ("misleading marketing ... will be removed", 3.1.1(a)). Plain "Buy on hiveop.io" is fine.
4. No external-purchase mention in the App Store metadata for non-US storefronts. The listing copy has none (listing.md) and one metadata set serves all countries.
5. Entitlement: none needed for US. Do not apply for the StoreKit External Purchase Link Entitlement unless the owner wants EU/Japan etc.

## Google Play (US)

Findings
- Since 2025-10-29 (US mobile and tablet apps), Play does not require Google Play Billing and does not prohibit linking out. Developers who link users to external purchases still must comply with the Payments policy and enroll in a program: **External content links** (for links) or **Alternative billing**. Source: https://support.google.com/googleplay/android-developer/answer/15582165?hl=en
- External content links program: enrollment is optional but required before linking; complete the declaration form and onboarding; enroll in Play Console (Settings > External content links); declare the links in App content > External apps declaration; limit links to US users and territories; the app must tell the user the destination and its purpose before linking out; track qualifying transactions and installs (incl. $0 trial purchases) through the external links APIs; check eligibility with `isBillingProgramAvailableAsync()` in Play Billing Library; provide customer support. Sources: https://developer.android.com/google/play/billing/externalcontentlinks , https://developer.android.com/google/play/billing/externalcontentlinks/integration , https://support.google.com/googleplay/android-developer/answer/16470497?hl=en
- Fees: enrolled developers must report transactions and downloads and pay service fees from 2026-10-01; external-content-links developers have until 2027-02-01 to report successful downloads and pay. Amounts are on the console pages; third-party summaries conflict on rates (20%/15%/10% appear in Apple's court filing citing Google's linked-out rates), so read the console.
- Status: the Epic/Google settlement motion to modify the injunction was withdrawn in July 2026, so the original October 2024 order governs (injunction reported to run to 2027-11-01): https://www.macrumors.com/2026/07/15/google-third-party-app-stores/

What ph-08 must do for Google (gaps in what shipped)
1. Owner enrolls the app in External content links and files the External apps declaration before the production release (not needed for internal testing).
2. Show the link only for US users: ph-08 reads the Play Billing country; also gate on the `isBillingProgramAvailableAsync()` result (not implemented; the shell uses Play Billing 7.1.1 for the country read only). Add if the console requires it.
3. **Add an in-app notice before opening the browser** naming the destination and why ("You'll leave the app to buy on hiveop.io"). ph-08 opens the browser directly with no interstitial. This is a likely follow-up slice.
4. Record link-initiated purchases for the external links reporting API; web checkout needs a `from=app` attribution (already in the URL) plus a server-side report job. Not built.
5. Provide customer support contact (support email on the listing).

## Owner decisions
- Whether to enroll in Google ECL now (needed for the US link) or ship Android with no link-out in the first release (safe: `hidden` mode everywhere).
- Whether to accept Apple's possible commission on linked-out sales.
- Fund the ph-08 follow-up slice for the Google interstitial + reporting.
