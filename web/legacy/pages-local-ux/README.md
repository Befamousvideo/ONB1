# Quarantined: Pages Router `/local`

These files used to live at `web/src/pages/` (`/local` + `_app.tsx`).

They are **not** part of the current local-first intake:

- They target a stale conversation contract (`account_id`, `sender_type`, `body`).
- Next.js hybrid `app/` + `src/pages/` routing can shadow or confuse the App Router intake at `/`.

Use `web/app/page.tsx` (route `/`) and `scripts/smoke.sh` instead.

Kept here only as a historical reference. Do not move them back under `web/src/pages` or `web/pages`.
