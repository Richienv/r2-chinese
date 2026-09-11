# Turning on accounts (Supabase)

The auth + sync code is already built and shipped. It stays **dormant** until two
public config values are present, so the live site keeps working local-only until
you finish these steps. When the two `VITE_SUPABASE_*` values exist, the app
requires sign-in and syncs each user's progress to their account.

## What you do (≈5 minutes)

1. **Create a free project** at <https://supabase.com> → New project. Pick a name
   and a database password (you won't need the password again for this app).

2. **Create the table.** In the project: **SQL Editor → New query**, paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This
   makes the `user_progress` table and its row-level-security policies.

3. **Email + password settings.** **Authentication → Providers → Email** is on by
   default. Under **Authentication → Sign In / Providers** (or **Settings**) you
   can toggle **"Confirm email"**:
   - *On* (default): new users must click a link in their inbox before their first
     sign-in. Most secure.
   - *Off*: sign-up logs them straight in — smoother for a personal/demo app.

4. **Grab the two public keys.** **Project Settings → API**:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public** key → `VITE_SUPABASE_ANON_KEY`

## What I do with them

Paste both values back to me. I will:

- add them to Vercel (**Production** env vars) and a local `.env` for testing,
- redeploy, and
- verify sign-up → sign-in → progress round-trips to the database and back on a
  fresh device.

> The anon key is meant to be public — it only permits what row-level security
> allows, which is "a signed-in user touches only their own row." Do **not** send
> me the `service_role` key; the app never uses it.

## What changes for users once it's on

- First screen is a **sign in / create account** form (email + password).
- Their streak, XP, saved words and review schedule live in their account and
  follow them to any device.
- **Profile → Sign out** ends the session; **Reset progress** clears their data.
- Offline still works: changes cache locally and sync on the next connection.
