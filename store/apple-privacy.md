# Apple App Privacy answers (nutrition label) — HiveOp phone app

Drafted 2026-11-04 from code. Re-check against the live backend before submitting.
Tracking: **No.** No ad SDKs, no data broker sharing, no cross-app identifiers (the shell links only Capacitor core, push, splash: `mobile/package.json`; the site has no analytics SDK: `wenrwa-arena/package.json`, grep for analytics/sentry/posthog = none).

Sources: backend = Wenrwa-Marketplace `origin/main`; site = wenrwa-arena `master`; shell = `hiveop-apps/mobile`.

| Apple data type | Collected? | Linked to user | Purpose | Code evidence |
|---|---|---|---|---|
| Contact Info: Email Address | Yes | Yes | App Functionality (sign-in, receipts), Account | `backend/src/database/migrations/080_create_users_table.sql` (`arena_users.email`); `services/transactional-email.ts` (code emails via Resend) |
| Contact Info: Name | Yes | Yes | App Functionality | same table `display_name`; Apple first-sign-in `user` JSON in `services/apple-auth.service.ts` |
| User Content: Photos or Videos | Yes | Yes | App Functionality | profile photo upload re-encoded, EXIF stripped: `services/avatar-image.ts`; shell `NSPhotoLibraryUsageDescription`/`NSCameraUsageDescription` in `mobile/ios/App/App/Info.plist` |
| User Content: Other User Content | Yes | Yes | App Functionality | workspace chat, files, code, prompts sent to agents: `services/workspace-chat.service.ts`, `global-chat.service.ts`; privacy page lists AI conversation + workspace content |
| User Content: Audio Data | Yes (conservative) | Yes | App Functionality | dictation/speech streams to a speech vendor (ElevenLabs): `services/voice/adapters/elevenlabs.ts`, `controllers/voice-dictation.controller.ts`. Declared even if only processed live; owner to confirm vendor retention setting |
| Identifiers: User ID | Yes | Yes | App Functionality | `arena_users.id`, session cookie `services/session.service.ts` |
| Identifiers: Device ID | Yes | Yes | App Functionality (push) | APNs/FCM device token in `push_devices` (`services/push/push.store.ts`) |
| Purchases: Purchase History | Yes | Yes | App Functionality | Stripe customer id + what was bought (web checkout, not in-app): privacy page s.1; backend Stripe config `config.ts` |
| Financial Info | No | | | Card data goes straight to Stripe on the web; not collected by us or the app |
| Usage Data: Product Interaction | Yes | Yes | App Functionality, Analytics (credit metering, activity feed) | credits ledger and workspace activity in backend; no third-party analytics in the app. Privacy page mentions Vercel Analytics on the marketing site only (not loaded by app.hiveop.io: no `@vercel/analytics` in wenrwa-arena) |
| Diagnostics: Crash / Performance | No | | | no Sentry or crash SDK in shell or site; server logs only (pino). Revisit if a crash SDK is added |
| Location | No | | | no location permission in `Info.plist` / `AndroidManifest.xml` |
| Contacts, Health, Browsing History, Search History, Sensitive Info, Other | No | | | not read anywhere |

Notes
- Sign in with Apple: `apple-auth.service.ts`; private-relay email counts as Email Address.
- GitHub/Google sign-in identity (provider id) stored as `oauth_provider_id` -> covered by User ID and Email.
- Data used for tracking: none. Data not linked: none claimed.
- Third parties receiving data: Anthropic (model inference; privacy page s.3), Stripe, Supabase, Vercel, ElevenLabs (voice), Resend (email), Fly (hosts user workspaces).
- Account deletion in app: You > Settings > Delete account (`routes/account-deletion.routes.ts`, ph-11/12) — satisfies guideline 5.1.1(v).

## Blockers to clear before submit (owner)

1. **Privacy policy is a draft.** https://hiveop.io/privacy carries "This is a starter draft ... pending review by counsel", was last updated 2026-05-05, and still describes Solana wallets, USDC and bounties. Apple reviewers open that URL. Needs counsel/owner rewrite: add push tokens, voice, Sign in with Apple, in-app deletion; drop parked features; remove the draft banner. Source: `hiveop-landing/src/data/pages/privacy.ts`.
2. **User-generated content (guideline 1.2).** Workspace chat and global chat exist. Backend has block/mute/report (`services/moderation.service.ts`, migration 180) and the client has report/block in `components/mobile/GlobalRoom.tsx` and `lib/api.ts`. Confirm the report and block controls are reachable on every chat surface a phone user sees at launch, plus published contact info (support email on the support URL).
3. Confirm the voice vendor retention setting.
