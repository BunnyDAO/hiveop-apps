---
id: ph-11
title: Account deletion on the server
type: AFK
status: done
blocked_by: []
parent: docs/prd/phone-apps.md
repo: Wenrwa-Marketplace
---

## What to build

`planDeletion(userId)` (pure planning over loaded data) → `{ blockedBy?, soloWorkspaces[], transfers[{workspace, newOwner}], credits, subscription }`; newOwner = longest-standing remaining member. `executeDeletion`: refuse if blockedBy (unpaid balance); cancel the Stripe subscription immediately without proration; transfer shared workspaces and notify the new owner; delete solo workspaces through the existing workspace-delete path (machines, volumes, storage, repos); remove memberships; revoke sessions, tokens and push devices; mark the account deleted (sign-in refused at once); hard-purge personal data within 30 days by a scheduled job; keep financial records de-identified. Endpoints: GET preview, POST delete with typed confirmation.

Covers user stories 30, 31, 33–35.

## Acceptance criteria

- [ ] Planner unit tests: solo vs shared, tie-breaks on join time, balance block
- [ ] Integration against a real test DB with real table names: transfer happens, solo workspace deleted, sessions revoked, sign-in refused, push devices gone
- [ ] Purge job removes personal fields after 30 days and leaves de-identified ledger rows
- [ ] Boot smoke with SKIP_MIGRATIONS=1

## Blocked by

None — can start immediately

## Done (2026-11-02)

Marketplace 55795535 (migration 280, additive). GET /me/account/deletion-preview, POST /me/account/delete {confirm:"DELETE"}; interactive sessions only. Owner decisions: paid plans on handed-on workspaces are cancelled immediately; the same email/wallet can sign up again at once as a new account (identity detached at deletion, purge after 30 days via AccountPurgeJob every 6 h). Open: native Apple token endpoint (ph-06) must check isAccountDeleted; LLM-proxy tokens live ≤1 h; wallet rewrite across ~75 tables untested at production volume; no real Stripe/Fly call made.
