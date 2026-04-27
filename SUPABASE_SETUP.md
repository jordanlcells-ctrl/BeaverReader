# Supabase Setup Instructions for BeaverReader

## Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub, Google, or email

## Step 2: Create a New Project

1. Click "New Project"
2. Fill in:
   - **Name**: BeaverReader
   - **Database Password**: (generate a strong password and save it)
   - **Region**: Choose closest to you
3. Click "Create new project"
4. Wait 1-2 minutes for setup to complete

## Step 3: Get Your API Credentials

1. In your project dashboard, click **Settings** (gear icon in sidebar)
2. Click **API** in the settings menu
3. Copy these values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

## Step 4: Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Supabase credentials:
   ```
   SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Generate the native env module (Metro reads `src/generated/env.native.ts`, not `.env` directly):
   ```bash
   npm run env:gen
   ```
   This also runs automatically on `npm install`, `npm start`, and `npm run android`.

4. Rebuild the app:
   ```bash
   npx react-native run-android
   ```

**Note:** The `.env` file is gitignored. Never commit credentials to version control. The generated `env.native.ts` contains inlined strings; keep it out of public forks if you ever commit real keys (the repo ships empty placeholders).

## Step 5: Configure Email Auth (Optional but Recommended)

By default, Supabase requires email confirmation. To disable for testing:

1. Go to **Authentication** → **Providers** → **Email**
2. Scroll to "Email Settings"
3. Toggle **OFF** "Confirm email"
4. Click "Save"

**For production:** Keep email confirmation ON for security!

## Step 6: (Optional) Backend API for Grammar & Translation

So users don’t need to add their own API keys, you can enable built-in grammar and translation:

1. Run the `app_usage` migration and deploy the Edge Functions (`grammar`, `translate`).
2. Set your API keys as Supabase secrets: `OPENAI_API_KEY` (required for grammar), `MYMEMORY_API_KEY` (optional for translation).

Full steps: see **[BACKEND_API_SETUP.md](./BACKEND_API_SETUP.md)**.

## Step 7: Set Up Database Tables (Part 7)

We'll create the database schema in Part 7 when we implement the deck system.
For now, authentication will work with just the default `auth.users` table.

## Step 8: Environment Variables (Required)

Supabase credentials are loaded from `.env`. See Step 4 above. The `.env` file is in `.gitignore` and must not be committed.

---

## ✅ Ready to Test!

Once `.env` is filled in and you have run `npm run env:gen` (or `npm start` / `npm run android`):

1. Rebuild the app: `npx react-native run-android`
2. Test signup, login, and logout flows

## Need Help?

- Supabase Docs: https://supabase.com/docs
- React Native Setup: https://supabase.com/docs/guides/getting-started/tutorials/with-react-native
