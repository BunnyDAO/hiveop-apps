# HiveOp store listing copy (ph-14)

Drafted 2026-11-04. Same copy for both stores unless noted. Plain, tight, no parked features.
Support URL: https://hiveop.io  Privacy policy URL: https://hiveop.io/privacy  Terms: https://hiveop.io/terms
Support email: support@hiveop.io (owner to confirm the mailbox exists; the privacy page lists privacy@ and security@).

## App Store

| Field | Text | Limit |
|---|---|---|
| Name | HiveOp: AI Agent Workspace | 30 |
| Subtitle | Run your agents from anywhere | 30 |
| Promo text | Get a buzz when an agent needs you. Approve, answer and steer your AI coding agents from your phone or tablet. | 170 |
| Keywords | coding,terminal,developer,repo,remote,dictation,team,chat,cloud,devtools,automation,assistant | 100 |
| Category | Developer Tools (secondary: Productivity) | |

Keywords are comma-separated, no spaces, no words already in the name or subtitle.

### Description (App Store)

```
HiveOp is a workspace where you and a fleet of AI agents build software together. The app puts it in your pocket.

Your agents keep working when you walk away. When one needs you, your phone buzzes. Tap it and you land on the exact thing to approve or answer.

- Needs-you alerts. A run waiting for approval, an agent with a question. One tap to act.
- Live terminals. Watch and steer each agent's terminal.
- Team chat. Talk with your teammates and agents in one place.
- Work graph. See what is queued, running and done.
- Dictation. Talk instead of typing.
- Cloud or local. Run workspaces in the cloud, or on your own machine.

Sign in with Apple, Google, GitHub or an email code. Delete your account any time from You > Settings.

HiveOp needs a HiveOp account. Works on iPhone and iPad; iPad shows the full desktop layout.

Claude Code and GitHub are named for compatibility only and belong to their owners. HiveOp is not affiliated with or endorsed by them.
```

## Google Play

| Field | Text | Limit |
|---|---|---|
| Title | HiveOp: AI Agent Workspace | 30 |
| Short description | Run your AI coding agents from your phone. Get a buzz when one needs you. | 80 |
| Category | Tools or Productivity (Play has no Developer Tools type for apps; Productivity recommended) | |
| Tags | Developer tools, Productivity | |

### Full description (Play)

```
HiveOp is a workspace where you and a fleet of AI agents build software together. The app puts it in your pocket.

Your agents keep working when you walk away. When one needs you, your phone buzzes. Tap it and you land on the exact thing to approve or answer.

WHAT YOU CAN DO
- Needs-you alerts: a run waiting for approval, an agent with a question. One tap to act.
- Live terminals: watch and steer each agent's terminal.
- Team chat: talk with your teammates and agents in one place.
- Work graph: see what is queued, running and done.
- Dictation: talk instead of typing.
- Cloud or local: run workspaces in the cloud, or on your own machine.

ACCOUNT
Sign in with Google, GitHub, Apple or an email code. Delete your account any time from You > Settings.

DEVICES
Phones and tablets. A wide tablet screen shows the full desktop layout.

HiveOp needs a HiveOp account.

Claude Code and GitHub are named for compatibility only and belong to their owners. HiveOp is not affiliated with or endorsed by them.
```

## Counts (script-checked 2026-11-04)

- App Store name: 26/30 OK
- Subtitle: 29/30 OK
- Promo: 110/170 OK
- Keywords: 93/100 OK
- Play title: 26/30 OK
- Play short: 73/80 OK
- App Store description: 965 chars (limit 4000)
- Play full description: 1008/4000 OK

## Banned-word / claim check (script-checked)

- titles/subtitle/promo/keywords/short: hits = none
- descriptions: hits = ['claude', 'github']
- Expected hits in descriptions: 'claude' and 'github' (factual disclaimer line only). 'token'/'web' etc. must be absent.
- Result: PASS (no hits in title, subtitle, promo, keywords or short description; descriptions only the two disclaimer marks).

## Notes for the owner

- "Claude Code" and "GitHub" appear once, last line of the descriptions, as factual compatibility. Not in any title, subtitle, promo, keyword or short description. Delete that line if you want zero third-party marks; nothing else depends on it.
- No mention of pricing, credits, plans, buying or the web store. Non-US storefronts must not hint at web purchase (ph-08, ADR-0002).
- Do not add "free" anywhere: local workspaces are free, but cloud workspaces spend credits.
- Features named are live on the MVP surface. Co-op discovery is left out on purpose (keep the listing to what every user sees).
- Verify before submit: the privacy page (https://hiveop.io/privacy) still says "starter draft ... pending review by counsel" and has crypto/wallet sections. See apple-privacy.md "Blockers".
