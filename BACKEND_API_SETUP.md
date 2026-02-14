# Backend API Setup (Grammar & Translation)

When users sign up, they get **built-in grammar and translation** without adding any API keys. You (the app owner) provide the keys once; the app uses them via Supabase Edge Functions with per-user rate limits.

## What’s included

- **Grammar (OpenAI)** – 30 requests per user per day via your OpenAI key.
- **Translation (MyMemory)** – 100 requests per user per day; optional MyMemory key for higher external limits.

Users can still add their **own** OpenAI or translation key in Settings for extra usage.

---

## 1. Run the migration (usage table)

Apply the migration that creates the `app_usage` table (used for rate limiting):

**Option A – Supabase Dashboard**

1. In your project: **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/20250214000000_create_app_usage.sql`.
3. Run the query.

**Option B – Supabase CLI**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

---

## 2. Deploy the Edge Functions

Install the Supabase CLI if needed, then deploy the `grammar` and `translate` functions:

```bash
# Install Supabase CLI (if you don't have it)
# npm install -g supabase

# Log in and link your project
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy both functions
npx supabase functions deploy grammar
npx supabase functions deploy translate
```

Replace `YOUR_PROJECT_REF` with your project ref (from the Supabase dashboard URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`).

---

## 3. Set secrets (your API keys)

Your keys are stored as **Supabase Edge Function secrets** (not in the app).

### Required: Grammar (OpenAI)

1. Get an API key from https://platform.openai.com/api-keys
2. In Supabase: **Project Settings** → **Edge Functions** → **Secrets** (or use CLI below).
3. Add:

| Name             | Value            |
|------------------|------------------|
| `OPENAI_API_KEY` | your OpenAI key  |

CLI:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

### Optional: Translation (MyMemory)

Without this, the Edge Function still calls MyMemory’s free tier (with its own limits). With a key you get higher MyMemory limits:

1. Get a free key: https://mymemory.translated.net/doc/keygen.php
2. Add secret:

```bash
npx supabase secrets set MYMEMORY_API_KEY=your-mymemory-key
```

---

## 4. Verify

1. **App:** Sign in and use **Grammar** or **Translate** on a selection. They should work without entering any key in the app.
2. **Limits:** After 30 grammar or 100 translation requests in a day, the user gets a “limit reached” message until the next day (or they can add their own key in Settings).

---

## Changing limits

Edit the constants in the Edge Function source, then redeploy:

- **Grammar:** `GRAMMAR_LIMIT_PER_DAY` in `supabase/functions/grammar/index.ts` (default 30).
- **Translation:** `TRANSLATION_LIMIT_PER_DAY` in `supabase/functions/translate/index.ts` (default 100).

Then:

```bash
npx supabase functions deploy grammar
npx supabase functions deploy translate
```

---

## Cost notes

- **OpenAI:** You pay for usage (gpt-4o-mini). Rate limits cap cost per user per day.
- **MyMemory:** Free tier or your key; no Supabase cost for the function beyond normal Edge Function usage.
- **Supabase:** Edge Function invocations and the `app_usage` table are small; check your plan for limits.
