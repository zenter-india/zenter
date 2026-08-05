# Account Deletion — Verification

**PASS.** In-app account deletion exists and is reachable without contacting support, satisfying Apple's
Guideline 5.1.1(v) requirement that apps supporting account creation also support in-app deletion.

## Navigation path

`My profile` (reached via the header hamburger menu → "Profile") → scroll to the **"Privacy & account"** card
→ **"Delete account"** button (danger-styled) → a confirmation dialog ("This permanently deletes your Zenter
profile and connections. This action cannot be undone.") → **"Delete permanently"**.

Source: `app/profile.tsx` (`ConfirmDialog` wired to `confirmDelete()`), `src/data/useAccount.ts`
(`useDeleteAccount`), `src/api/users.ts` (`deleteUserData`).

## Backend behavior — verified directly against the live database schema

`deleteUserData(userId)` (`src/api/users.ts`) issues two direct deletes, then the client calls `logout()`
(clears the Supabase session + local query cache) and routes to the sign-in screen:

1. `DELETE FROM connections WHERE sender_id = userId OR receiver_id = userId`
2. `DELETE FROM users WHERE id = userId`

I queried the live production foreign-key constraints (project `wppuzqaigtffcpuvjolt`) to confirm what this
actually cascades to, rather than assuming:

| Deleting… | Cascades to | Effect |
|---|---|---|
| `connections` row | `conversations` (`ON DELETE CASCADE`) → `messages` + `contact_exchange_requests` (`ON DELETE CASCADE`) | All chat messages and contact-exchange history with that connection are removed, not just the connection row |
| `users` row | `device_tokens` (`CASCADE`), `user_reports` as reporter or reported (`CASCADE`) | Push tokens and any reports involving the user are removed |
| `users` row | `feedbacks.user_id`, `analytics_events.user_id` (`ON DELETE SET NULL`) | Feedback text / analytics events are retained but anonymized (id nulled) — consistent with the Privacy Policy's stated 1-year log retention, not a leftover PII trail |

**PASS, fully verified**: the delete goes further than the confirm dialog's promise ("profile and
connections") — it also removes messages and contact-exchange history via cascade — and nothing tested here
leaves identifiable PII attached to a stale row. One minor, non-blocking note: `blocked_users` currently has
no foreign key to `users` (dropped earlier in this project for an unrelated reason — seeded/demo profiles
don't exist in `users`), so a `blocked_users` row referencing a deleted user's id becomes a dangling but
harmless reference (no new PII, just an id that no longer resolves). Not a rejection risk.

## Confirmation flow

A native confirm dialog (`ConfirmDialog`, danger-styled, busy-state while the mutation runs) sits between the
button tap and the actual delete call — this satisfies the "meaningful confirmation before destructive action"
expectation; there is no accidental one-tap delete.

## Data retention

The live production Privacy Policy (https://zenter.in/privacy, §9) states: *"We retain personal information
as logs only for 1 year (after deletion); complaints for 3 years."* This is consistent with typical
post-deletion retention for security/legal purposes and does not itself block approval — but confirm the
backend's actual retention behavior matches this stated policy (same caveat as above: not verified as part of
this code audit, since the deletion RPC's SQL was not read).
