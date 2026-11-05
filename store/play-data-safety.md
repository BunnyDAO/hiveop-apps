# Google Play Data safety answers — HiveOp

Drafted 2026-11-04 from the same code as apple-privacy.md (see its source list).

## Overview questions
- Collects or shares required user data types: **Yes**
- All data encrypted in transit: **Yes** (HTTPS only; TLS 1.2+ per privacy page s.7; shell loads https://app.hiveop.io)
- Users can request data deletion: **Yes** — in-app You > Settings > Delete account, and web. Provide the deletion URL: https://app.hiveop.io (You > Settings > Delete account) plus privacy@hiveop.io. Code: `backend/src/routes/account-deletion.routes.ts`, `services/account-deletion/*`; hard purge within 30 days.
- Data shared with third parties: **No** for "sharing" as Google defines it, because processors acting for us (Stripe, Supabase, Vercel, Anthropic, ElevenLabs, Resend, Fly) are service providers. Keep that wording consistent with the final privacy policy; if counsel treats Anthropic inference as sharing, mark Messages/Files as shared.
- Independent security review: No.

## Data types

| Play category > type | Collected | Shared | Optional? | Purpose | Evidence |
|---|---|---|---|---|---|
| Personal info > Email address | Yes | No | Required | Account management, App functionality | `migrations/080_create_users_table.sql`, `transactional-email.ts` |
| Personal info > Name | Yes | No | Required | Account management | `arena_users.display_name` |
| Personal info > User IDs | Yes | No | Required | App functionality, Account management | `arena_users.id`, `session.service.ts` |
| Photos and videos > Photos | Yes | No | Optional | App functionality | profile photo, `avatar-image.ts`; `CAMERA` permission |
| Audio > Voice or sound recordings | Yes | No | Optional | App functionality | dictation, `services/voice/*`; `RECORD_AUDIO` permission in `mobile/android/app/src/main/AndroidManifest.xml` |
| Messages > Other in-app messages | Yes | No | Required to chat | App functionality | `workspace-chat.service.ts`, `global-chat.service.ts` |
| Files and docs > Files and docs | Yes | No | Optional | App functionality | files/code uploaded to workspaces (privacy page s.1) |
| App activity > App interactions | Yes | No | Required | App functionality, Analytics (metering) | credits ledger, activity feed; no third-party analytics SDK |
| App info and performance > Crash logs / Diagnostics | No | | | | no crash SDK in shell or site |
| Device or other IDs > Device or other IDs | Yes | No | Optional (push) | App functionality | FCM token, `push_devices` in `services/push/push.store.ts`; `POST_NOTIFICATIONS` permission |
| Financial info > Purchase history | Yes | No | Required to buy | App functionality | Stripe customer id + records; purchases happen on the web |
| Financial info > Payment info | No | | | | Stripe handles cards on the web |
| Location, Contacts, Calendar, Health, Web browsing, Search history | No | | | | not accessed |

## Related Play declarations
- Ads: No ads.
- Target audience: 18+ (see age-rating.md).
- Account deletion URL and in-app path both required by Play: provided above.
- Financial features: none. Government/news/health: none.
- External content links (US): see link-out-rules.md; also declare the link under Play Console > App content > External apps declaration if enrolled.
