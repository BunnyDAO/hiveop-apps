---
id: ph-11
title: Account deletion on the server
type: AFK
status: open
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
