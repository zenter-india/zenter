# User-Generated Content Safety (Guideline 1.2)

Zenter has real UGC surfaces: free-text profile fields (`bio`, `full_name`, `college`) and 1:1 chat messages
(`messages` table, unmoderated free text up to 2000 chars per `messages.body`'s check constraint).

Apple's Guideline 1.2 minimum bar for apps with UGC is: a method to filter objectionable content, a mechanism
to report it, the ability to block abusive users, and published contact information. Checked each:

| Requirement | Status | Evidence |
|---|---|---|
| Mechanism to report objectionable content/users | **Yes — folded into Block.** `useBlockActions` (`src/features/safety/useBlockActions.tsx`) is explicitly documented in-repo as *"the report mechanism"* — blocking requires selecting a reason (`BlockSheet`), which functions as the report. There is a separate `user_reports` table live in the database with `reason`/`details`/`status` columns, but **no app UI currently writes to it** — reports only ever happen via the block-with-reason flow. | `src/features/safety/useBlockActions.tsx`, live schema check |
| Ability to block abusive users | **Yes.** | `BlockButton`, `useBlockActions`, `blocked_users` table (RLS-enabled) — blocking a user removes them bidirectionally from each other's feed (verified via query invalidation in `useBlockActions`'s header comment) |
| Content filter (proactive, automated) | **No automated filter found.** No profanity filter, no image/content moderation pipeline (there are no images to moderate — text only), no keyword blocklist in `sendMessage`/`submitFeedback`. Moderation is entirely reactive (block/report after the fact), not preventive. | `src/api/chat.ts`, `src/api/feedback.ts` — no filtering logic present |
| Published contact information for reporting concerns | **Yes.** | `support@zenter.in`, `+91 6363613007`, both live in `app/contact.tsx` and the production Privacy Policy |
| Terms/community rules users agree to | **Yes.** | `app/community.tsx` (Community Guidelines), `app/terms.tsx` — both reachable from the header hamburger menu on every screen |

## Risk assessment

The block/report/contact/terms combination satisfies Apple's **stated minimum** for Guideline 1.2. The one
gap worth being aware of: purely reactive moderation (no proactive filter) is common for small-scale P2P apps
and is generally accepted by Apple as long as report+block+contact exist — which they do here — but it is the
kind of thing that occasionally draws a reviewer follow-up question for chat-enabled apps, especially ones
matching strangers (which this app fundamentally does: exam-centre co-ordination between people who don't
know each other). If review does flag it, the `APP_REVIEW_INFORMATION.md` review notes already explain the
block-with-reason mechanism, which should pre-empt most of that friction.

**No RELEASE BLOCKER identified here** — the existing block/report/contact/terms combination is a reasonable,
defensible Guideline 1.2 answer for this app's actual scale and content type (text-only, no images/video/audio
UGC surface at all, which meaningfully narrows the objectionable-content surface area vs. a media-sharing
app).
