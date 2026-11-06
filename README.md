# Out of the Hat

Multi-party Secret Santa. Anyone signs in with their email (one-time code, no password), then starts a party or joins one from an invite link. The host draws names; everyone gets an email and sees their giftee on the party page.

Next.js 16 (App Router, server actions) · Supabase (Auth + Postgres + RLS) · Resend · Vercel.

## How it works

- **Sign-in** is a 6-digit email code (`signInWithOtp` + `verifyOtp`), not a magic link. Magic links break when opened in a mail app's in-app browser, which is where most family members will open them.
- **Invite links** are `/join/<code>`: a 10-character code from an unambiguous alphabet. Anyone with the link can join until names are drawn.
- **The draw** (`draw_names()` in Postgres) locks the party, shuffles members into one loop (each person gives to the next), writes assignments and in-app notifications, and closes the party, all in one transaction. A join racing the draw waits for it.
- **Secrecy** is enforced by RLS: a giver can read only their own assignment row. The host sees delivery counts, never pairs.
- **Emails** are sent server-side with the Supabase secret key, then the delivery status is recorded per assignment. The host can resend any that failed.

## Setup

1. **Supabase project.** With the Supabase GitHub integration enabled, migrations in `supabase/migrations/` apply on merge to `main`. Without it, run them with `supabase db push`.
2. **Auth → Email templates → Magic Link:** paste `supabase/templates/magic_link.html`. It must contain the code, e.g.
   `<p>Your Out of the Hat code is <strong>{{ .Token }}</strong></p>`.
   Without `{{ .Token }}` people get a link and no code.
3. **Auth → SMTP settings:** point it at Resend (host `smtp.resend.com`, port 465, user `resend`, password = your Resend API key). Supabase's built-in mailer is limited to a handful of emails an hour and will fail as soon as a family signs up at once.
4. **Auth → URL configuration:** set the Site URL to your deployed URL.
5. **Resend:** verify your sending domain and create an API key.
6. **Env vars:** copy `.env.example` to `.env.local` (and into Vercel). Then:

```bash
pnpm install
pnpm dev
```

## Scripts

`pnpm dev` · `pnpm build` · `pnpm typecheck`
