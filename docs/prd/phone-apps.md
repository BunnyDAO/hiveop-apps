# HiveOp phone apps (iOS + Android, phones + tablets)

Domain: **app shells** (hiveop-apps), with site changes in wenrwa-arena and backend changes in Wenrwa-Marketplace. Respects ADR-0001 (shells load the live site) and ADR-0002 (phone apps sell nothing in-app; US link-out).

## Problem Statement

People who want HiveOp on their phone today have to open a browser, find app.hiveop.io, sign in, and keep a tab alive. There is no app in the App Store or Google Play, nothing on the home screen, and nothing tells them when an agent is stuck waiting on them unless they happen to look. The owner wants people to "just log in to the app and not mess with the browser", with the app working identically to the browser.

## Solution

A HiveOp app in the App Store and Google Play, published by Wenrwa LLC, for iPhone, iPad, Android phones and Android tablets. It is a thin native shell around the live site, like the desktop app: one site deploy updates browser, desktop and phone alike. Users sign in once (Apple, Google, GitHub or email code) and stay signed in. Everything the phone browser can do, the app does, with the same layout rules (phone layout under 1024px, desktop layout above). On top of the site it adds what a browser cannot: push notifications when an agent needs you, Sign in with Apple, HiveOp links opening in the app, and a proper loading/offline experience. Account deletion becomes possible from the app and the site. Buying follows store rules: a "buy on hiveop.io" link in the US storefront, no purchase buttons elsewhere.

## User Stories

### Getting and opening the app
1. As a phone user, I want to install HiveOp from the App Store or Google Play, so that I don't need a browser tab.
2. As an iPad or Android tablet user, I want the same app to work on my tablet, showing the desktop layout when the screen is wide enough, so that I get Commander on a big screen.
3. As a user opening the app, I want a dark HiveOp loading screen instead of a white flash, so that the app feels native.
4. As a user with no signal, I want a "Can't reach HiveOp" screen with a Try again button that also retries by itself when the network returns, so that I'm never stuck on a blank page.
5. As a user who loses signal mid-use, I want the site's own reconnecting state, not an app-level error, so that I don't lose my place.
6. As a user returning to the app after a while, I want to land where I was, so that I don't have to navigate back.
7. As a user, I want the app to keep me signed in across restarts, so that I sign in once.
8. As a user inside the app, I never want to see the "Install HiveOp" or "Get the desktop app" banners, so that the app doesn't advertise itself to me.

### Signing in
9. As an iPhone user, I want Sign in with Apple with Face ID, so that signing up is one tap.
10. As a web user who signed up with Apple on my phone, I want Sign in with Apple on the website too, so that I can reach my account from my laptop.
11. As a user choosing Google or GitHub in the app, I want a secure sign-in sheet that returns me to the app signed in, so that Google doesn't block me for using an embedded browser.
12. As a user choosing the email code, I want it to work in the app exactly as on the web, so that I have a passwordless option.
13. As a user tapping the sign-in link in my email on my phone, I want it to open the app and sign me in, so that I don't end up signed in in a browser instead.
14. As a user who used "Hide my email" with Apple, I want my account to work normally, so that privacy doesn't cost features.

### Notifications
15. As a user who just signed in for the first time, I want a HiveOp screen explaining "Get a buzz when an agent needs you" with Turn on / Not now, before the system prompt, so that I understand what I'm allowing.
16. As a user who tapped Not now, I want to be asked once more, the first time a needs-you item actually arrives, so that the ask comes when it's relevant, and never again after that.
17. As a user with notifications on, I want my phone to buzz when an agent needs me (a run waiting for my approval, an agent asking a question), even with the app closed, so that my agents don't sit idle.
18. As a user tapping a notification, I want the app to open that exact item, so that I can act in one tap.
19. As a user, I want the app icon badge to show how many items need me, matching the Inbox bell, so that I can see at a glance.
20. As a user, I want one Notifications switch in You → Settings, so that I can turn buzzes off and on.
21. As a user who blocked notifications in phone Settings, I want the switch to tell me so and offer a button straight to the phone's Settings, so that I can fix it.
22. As a user with HiveOp on two phones, I want both to buzz, so that I don't miss it on whichever I'm holding.
23. As a user who signs out on a phone, I want that phone to stop getting my notifications, so that someone else holding it doesn't see them.
24. As a user, I want the same needs-you item not to buzz me twice, so that notifications stay trustworthy.

### Links
25. As someone who receives an app.hiveop.io link (invite, workspace, Inbox item), I want it to open in the app if installed, otherwise in the browser, so that links just work.

### Buying and plans
26. As a US user in the app, I want a "Buy on hiveop.io" button that opens checkout in my browser, so that I can top up quickly.
27. As a non-US user in the app, I want to see my plan and credit balance with no purchase buttons, so that the app follows store rules.
28. As any app user, I want subscription management, cancellation and receipts to behave per the same storefront rule, so that nothing in the app breaks store policy.

### Account deletion
29. As a user on the site or in the app, I want You → Settings → Delete account, so that I can leave HiveOp completely.
30. As a user about to delete, I want a clear list of what goes: my solo workspaces with their agents, machines and files; my credits; my subscription; my membership elsewhere, so that I know the cost.
31. As a user about to delete, I want to see which shared workspaces will pass to which member, so that I know nobody else loses work.
32. As a user, I want to type DELETE to confirm, so that I can't do it by accident.
33. As a user who owes money, I want to be told to pay first, so that deletion isn't a way to skip a bill.
34. As a deleted user, I want to be signed out everywhere at once and have my data permanently gone within 30 days, so that deletion is real.
35. As a member who inherits a shared workspace, I want a notice that I'm now its owner, so that I'm not surprised.

### Everything else works like the browser
36. As a phone app user, I want dictation (mic), profile photo (camera/library) and file pickers to work, with clear permission prompts, so that nothing is missing versus the browser.
37. As a phone app user, I want the terminal keyboard and composer to behave as in the phone browser, so that I can drive agents from the app.
38. As a user installing the GitHub App or opening the billing portal from the app, I want an in-app browser sheet that returns me to where I was, so that I don't lose context.
39. As a user tapping an outside link (docs, a PR on github.com), I want it in an in-app browser sheet, so that HiveOp stays one tap away.

### Owner / operator
40. As the owner, I want to test both apps on my iPhone (TestFlight) and an Android simulator before submitting, so that nothing ships untested.
41. As the owner, I want both apps submitted together with complete store listings (screenshots for phone and tablet, privacy details, a reviewer demo account), so that review passes first time.
42. As the owner, I want to know which phone app versions are in use (user agent), so that site changes stay compatible.

## Implementation Decisions

### Phone shell (hiveop-apps/mobile, Capacitor)
- **One Capacitor project** for iOS and Android, sibling to `desktop/`. Loads `https://app.hiveop.io` as the server URL (overridable for staging/dev). No site code bundled (ADR-0001). App ids `io.hiveop.app` (both stores). Display name "HiveOp". Universal (iPhone + iPad); Android phones + tablets. Supports all orientations on tablets, portrait on phones.
- **Shell bridge to the site**: one global, `window.hiveopApp = { version, platform: 'ios'|'android', has(capability), ... }`, injected only for the site origin. Capabilities at launch: `auth-bounce`, `apple-sign-in` (iOS native), `push`, `storefront`, `open-sheet`, `open-settings`. The site feature-detects by capability, never by version.
- **Navigation policy** (deep, pure, shared shape with desktop): `decide(url, context) → in-app | sheet | auth-session | system-browser | deny`. In-app: the site origin and the backend email/auth chain. Auth-session: Google and GitHub OAuth. Sheet (SFSafariViewController / Custom Tabs): GitHub App install, Stripe billing portal, outside links. System browser: US checkout link-out. Non-http(s) schemes denied except `hiveop:`.
- **Browser-bounce on phones**: reuses the desktop mechanism (PKCE-bound handoff; ASWebAuthenticationSession on iOS, Custom Tabs on Android). It returns through the existing `/desktop-return` page to `hiveop://auth?handoff=…`, and the shell has the site exchange it with the verifier it holds. No backend change beyond what desktop shipped.
- **Native Sign in with Apple (iOS)**: the system sheet returns an identity token. The site posts it to a new backend endpoint, which verifies it and signs in.
- **Push**: Capacitor push plugin. iOS registers with APNs directly (token-based key); Android uses FCM. The shell reports permission state (`unknown | granted | denied | not-now`) and the device token to the site, which registers it with the backend. Tapping a notification opens its `path` in the app. The badge is set from the payload.
- **Storefront**: a small native plugin returns the store's country (iOS StoreKit storefront; Android Play Billing config). Anything unknown counts as non-US.
- **Universal / App Links** for app.hiveop.io, plus `hiveop://` for auth return.
- **Loading / offline**: a native splash in HiveOp dark with the hexagon. A local "Can't reach HiveOp" page with Try again plus auto-retry on network change (backoff). State restored on resume (the WebView keeps the page; it doesn't reload unless it was killed).
- **Permissions**: mic, camera, photo library usage strings. The Android WebView grants getUserMedia only for the site origin and only after the OS grant.
- **Identity**: the user agent appends `HiveOpApp/<version> (<platform>)`.
- **Builds/release**: iOS built with Xcode CLI and uploaded with an App Store Connect API key. Android: release bundle signed with an upload key; Play App Signing on. Version numbers come from one source.

### Site (wenrwa-arena)
- **App shell reader** (deep, pure): the single module that reads `window.hiveopApp` (and the existing desktop global), returning `{ kind: 'browser'|'desktop'|'phone-app', caps }`. Nothing else touches the globals.
- **Purchase gate** (deep, pure): `purchaseMode(shell, storefront) → 'buy' | 'link-out' | 'hidden'`. Every buy/upgrade/plan-pick/pack/paywall CTA goes through it. Phone app with US storefront → link-out (system browser); otherwise in the phone app → hidden (no mention of the web). USDC packs are hidden in phone apps regardless. A guard test fails if a purchase CTA bypasses the gate.
- **Sign-in panel**: Apple button (native on iOS app; web flow elsewhere). Google/GitHub use the auth bounce in the phone app.
- **Push UX**: the post-sign-in pre-prompt screen; the one-time re-ask on the first needs-you arrival; the Notifications switch in You → Settings with a "blocked" state and an open-settings button. Registers/unregisters the device token with the backend (unregister on sign-out).
- **Install banners**: none in the phone app.
- **Account deletion UI**: You → Settings → Delete account (site and apps). It shows the backend's deletion preview (solo workspaces, transfers with the new owner named, credits, subscription), takes typed DELETE, and handles the blocked-for-balance state.
- **Well-known files**: `apple-app-site-association` and `assetlinks.json` served from app.hiveop.io.

### Backend (Wenrwa-Marketplace)
- **Sign in with Apple** (new provider): web OAuth (Services ID, form_post callback) and native identity-token verification (Apple JWKS, audience = bundle id or Services ID). Account matching follows the existing provider-linking rules; private-relay emails are treated as real emails.
- **Push devices**: a table (user, platform, token, app version, timestamps), register/unregister endpoints, and token pruning when APNs or FCM reports it dead. Removed on sign-out and account deletion.
- **Needs-you notifier** (deep module): `onNeedsYou(item) → deliveries`. It resolves recipients, respects the user's switch, dedupes per item (an item buzzes once), builds `{title, body, path, badge}` and sends via APNs/FCM. The badge equals that user's needs-you count. It is hooked where needs-you items are created (crew-run proposals, human gates/agent questions). The same rule as the site's needs-you count is shared or mirrored and pinned by a parity test.
- **Account deletion** (deep module): `planDeletion(userId) → { blockedBy?, soloWorkspaces[], transfers[{workspace, newOwner}], credits, subscription }` (pure planning) and `executeDeletion`:
  - Cancel the Stripe subscription immediately with no proration.
  - Transfer shared workspaces to the longest-standing member, and notify them.
  - Delete solo workspaces, including machines, volumes, storage and repos, through the existing workspace-delete path.
  - Remove memberships, then revoke sessions, tokens and push devices.
  - Mark the account deleted at once, so sign-in is refused, and hard-purge personal data within 30 days.
  - Financial records (ledger, Stripe) are kept de-identified, as the law requires.
  - Deletion is blocked while an unpaid balance exists.
- **Storefront is client-reported**, used only for showing CTAs; checkout itself is unchanged.

### Cross-repo contracts at risk
- `window.hiveopApp` shape (shell ↔ site), versioned by capability strings.
- Push device registration and payload (`path`, `badge`) (site/shell ↔ backend).
- Apple sign-in endpoints (site/shell ↔ backend).
- Deletion preview shape (backend ↔ site).
- The needs-you definition (site badge ↔ backend notifier), pinned by a parity test.

## Testing Decisions
- Test external behavior through pure decision modules first. Then backend integration tests against a real test database (the delete cascade, push registration). Then a simulator smoke on both platforms.
- **Pure, unit-tested**: phone navigation policy; app shell reader; purchase gate (every shell × storefront combination); push permission state machine (unknown → pre-prompt → granted/denied/not-now → re-ask once); notification tap → path parsing (path-sanitised like the desktop deep link); deletion planner (solo vs shared, longest-standing member, balance block); needs-you notifier (recipients, switch, dedupe, badge).
- **Guard test**: no purchase CTA renders outside the purchase gate (assert rendered output for a phone-app non-US shell, not source text).
- **Backend integration**: Apple token verification with a test key set; deletion end to end (workspaces transferred and deleted, sessions revoked, account unusable); push token prune on a dead-token response.
- **Simulator smoke (headless)**: iOS simulator booted with `simctl` without opening Simulator.app; Android emulator with `-no-window`. Load the site, sign in by email code, open Inbox, receive a test push (simctl push / FCM test), and tap it to open the item. No visible windows on the owner's screen.
- **Prior art**: desktop `navPolicy`, `deepLink`, `authBounce` tests; arena mobile shell tests; Marketplace workspace-delete tests.
- **Owner drill (HITL)**: TestFlight on the owner's iPhone. Sign in with Apple, a push arriving with the app closed, dictation, terminal typing, the US link-out, and account deletion on a throwaway account.

## Out of Scope
- Apple/Google in-app purchase (ADR-0002 fallback only if review demands it).
- Push for agent-finished, chat mentions, join requests; notification categories or quiet hours.
- Widgets, share sheet, Siri, offline mode, a bundled site copy.
- Local-bridge features on phones (they behave exactly as in the phone browser today).
- Workspace ownership hand-off by choice before deletion (automatic transfer only).
- Store-listing translations; markets beyond default availability.

## Further Notes
- **Owner actions**:
  - Install Xcode.
  - Create a Firebase project (FCM, free).
  - Create an APNs key and an App Store Connect API key once Apple approves.
  - Keep a backup of the Android upload key.
  - Provide a demo account with credits for Apple's reviewer.
- **Apple review risk**: a "website in a box" (4.2) is countered by native push, Sign in with Apple, universal links and native sign-in sheets. The US link-out rules for both stores must be re-checked right before submission.
- **Disk**: Xcode plus iOS runtime plus Android SDK is about 25 GB, and 38 GB is free.
- The MVP launch cut still applies: wallets, crypto, Crews and Arena stay hidden; phone apps additionally hide USDC packs regardless of flags.
