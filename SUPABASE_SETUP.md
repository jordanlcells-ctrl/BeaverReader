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

## Step 4: Update Your App

Open `src/services/supabase.ts` and replace:

```typescript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

With your actual credentials:

```typescript
const supabaseUrl = 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Step 5: Configure Email Auth (Optional but Recommended)

By default, Supabase requires email confirmation. To disable for testing:

1. Go to **Authentication** → **Providers** → **Email**
2. Scroll to "Email Settings"
3. Toggle **OFF** "Confirm email"
4. Click "Save"

**For production:** Keep email confirmation ON for security!

## Step 6: Set Up Database Tables (Part 7)

We'll create the database schema in Part 7 when we implement the deck system.
For now, authentication will work with just the default `auth.users` table.

## Step 7: (Optional) Create .env File

For better security, you can use environment variables:

1. Create a `.env` file in the project root:
```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

2. Add to `.gitignore` (already there by default)

**Note:** For now, hardcoding in `supabase.ts` is fine for development.

---

## ✅ Ready to Test!

Once you've updated `src/services/supabase.ts` with your credentials:

1. Rebuild the app: `npx react-native run-android`
2. Test signup, login, and logout flows

## Need Help?

- Supabase Docs: https://supabase.com/docs
- React Native Setup: https://supabase.com/docs/guides/getting-started/tutorials/with-react-native
