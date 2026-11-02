# HiveOp apps — glossary

**App shell** — the native program (desktop now, phone later) that shows the live HiveOp site. It carries no copy of the site; a site deploy changes what every shell shows.

**Desktop app** — the app shell for Mac, Windows and Linux. Exactly one HiveOp window, plus a menu-bar / tray icon that outlives the window.

**Site** — app.hiveop.io, the same web app a browser tab shows. The shell never forks it.

**Native browser** — a real browser view inside the desktop app's browser pane. Replaces the plain frame and the "open in new tab" fallback. Not the **streamed browser**.

**Streamed browser** — the remote Chrome running next to a cloud workspace's box, streamed into the pane. Still used for the box's own localhost when no team preview URL exists.

**Managed bridge** — the local bridge when the desktop app runs and updates it. Same bridge as the CLI one; only the owner differs.

**CLI bridge** — a local bridge the user started themselves (npx or the auto-start plist). The desktop app can offer to take it over.

**Bridge update** — a newer bridge version swapped in by the desktop app while no local agent is running. Separate from a **shell update**.

**Shell update** — a new release of the app shell itself. Rare; the site updates without one.

**Browser bounce** — sign-in that leaves the app for the system browser (Google) and returns to the app signed in.

**Phone app** — the app shell for iPhone, iPad and Android phones and tablets, published in the App Store and Google Play under Wenrwa LLC. Shows the site's phone or desktop layout by screen width, exactly as a browser would.

**Push notification** — a buzz on the phone sent by the server when a **needs-you item** appears, even with the app closed. Tapping it opens that item. Distinct from the in-app toast and the Inbox badge.

**Needs-you item** — an Inbox item that blocks on a person (a run waiting for approval, an agent asking a question); the same items counted on the Inbox bell. The only push trigger at launch.

**Push device** — one installed phone app that may receive push notifications for one signed-in account. Removed on sign-out, account deletion, or when the store says the token is dead.

**Store link-out** — the "buy on hiveop.io" button a phone app shows only in the US storefront. Elsewhere the phone app shows no purchase buttons and does not mention buying on the web.

**Account deletion** — the user removing their HiveOp account themselves, from the site or a phone app. Solo-owned workspaces go with it; shared workspaces pass to their longest-standing member. Not the same as cancelling a plan.

**Sign in with Apple** — a sign-in provider alongside Google, GitHub and the email code, on the site and in the phone apps.
