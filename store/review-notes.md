# Reviewer notes (Apple App Review notes + Play app access)

Drafted 2026-11-04. Paste the block below into App Review Information > Notes, and into Play Console > App access.

## Demo account — OWNER MUST CREATE (not created by agents; no prod accounts touched)
Needs: a normal account (email-code sign-in will not work for reviewers, they cannot read your inbox) so create it so a reviewer can log in without a code. Options, owner picks:
1. Account with a verification-free path the reviewer can use (e.g. a reviewer sign-in that accepts a fixed code) if the backend supports one. Check with `backend/src/routes/auth.routes.ts` and `services/auth-security.service.ts`; if none exists, that is a missing slice.
2. Or a Google/GitHub test account whose password and 2FA you hand to Apple (Apple allows).
Account must have: enough credits to run an agent for a few minutes (suggest 2,000 credits), one cloud workspace already created with an agent present, one pending needs-you item (so push and Inbox can be shown), notifications switched on.
Username/password fields in the console: fill with the account above. Rotate the password after review.

## Notes block
```
HiveOp is a workspace for running AI coding agents. This app is the HiveOp site (app.hiveop.io) in a native shell, plus native features the web cannot do:
- Push notifications when an agent needs a person (needs-you alerts), with tap-to-open and an icon badge.
- Native Sign in with Apple (iPhone/iPad); Google/GitHub sign-in use the system secure sheet.
- Links to app.hiveop.io open the app (universal links).
- Camera/photo library for profile photo, microphone for dictation.

Sign in with the demo account in the fields above. A workspace with an agent and one waiting item is ready. Tap Inbox to see the item. Dictation: tap the mic in a terminal or chat.

Account deletion: You > Settings > Delete account.
Purchases: the app sells nothing inside the app. In the US storefront a "Buy on hiveop.io" link opens the system browser; elsewhere the app shows no purchase buttons. Credit balance and plan name are display only.
User content: chat is between workspace members and agents. Members can block, mute and report; contact support@hiveop.io.
Encryption: standard HTTPS only.
```
Play "App access": same account, same steps. Mark "all functionality available with these credentials".

## Review risks to be ready for
- 4.2 "website in a box": answered by the native list above (push, Sign in with Apple, universal links).
- 3.1.1 / 3.1.1(a): see link-out-rules.md.
- 1.2: needs visible report/block and contact info; see apple-privacy.md blockers.
- 5.1.1(v): deletion present.
