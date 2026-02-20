# Backend API Setup (Mistral: Define, Translate, Ask AI)

The app uses **one provider (Mistral)** for **Define**, **Translate**, and **Ask AI**. You provide a single Mistral API key; the backend enforces an **app-wide monthly cap** so you never exceed the Mistral free tier.

## What’s included

- **Define** – Word/phrase definitions (with conjugation/synonyms when relevant) via Mistral.
- **Translate** – English ↔ Spanish translation via Mistral.
- **Ask AI** – Grammar and language questions only; opens a small window for the user’s question, then answers via Mistral.

**Limits**

- **App-wide:** One monthly request cap (e.g. 4000 requests) so the app stays within the Mistral free account.
- **Per user:** 50 actions per user per day (define + translate + ask combined).

No user API keys are required; all traffic goes through your backend.

---

## 1. Run the migrations

Apply the migrations that create the usage tables:

**Option A – Supabase Dashboard**

1. In your project: **SQL Editor** → **New query**.
2. Run in order:
   - `supabase/migrations/20250214000000_create_app_usage.sql`
   - `supabase/migrations/20250214100000_create_app_monthly_usage.sql`

**Option B – Supabase CLI**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

---

## 2. Deploy the Mistral Edge Function

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy the mistral function (handles define, translate, ask)
npx supabase functions deploy mistral
```

Replace `YOUR_PROJECT_REF` with your project ref (from the Supabase dashboard URL).

**If you see "Invalid JWT" in the app:** The function is deployed with JWT verification disabled at the gateway (`supabase/config.toml` has `verify_jwt = false` for `mistral`). The function still validates the token in code and returns 401 for invalid/missing tokens. Redeploy after pulling the config:

```bash
npx supabase functions deploy mistral
```

---

## 3. Set secrets

Your Mistral key is stored as a **Supabase Edge Function secret**. The function also needs the **service role key** (usually set automatically when deployed) to update the app-wide usage table.

### Required: Mistral

1. Get an API key from https://console.mistral.ai/ (free tier available).
2. In Supabase: **Project Settings** → **Edge Functions** → **Secrets** (or use CLI below).
3. Add:

| Name              | Value           |
|-------------------|-----------------|
| `MISTRAL_API_KEY` | your Mistral key |

CLI:

```bash
npx supabase secrets set MISTRAL_API_KEY=your-mistral-key
```

### Optional: Monthly request cap

Default is **4000** requests per month. To override, set:

```bash
npx supabase secrets set MONTHLY_REQUEST_CAP=5000
```

(Leave unset to use the default in code.)

---

## 4. Verify

1. **App:** Sign in, select text in a book, and use **Define**, **Translate**, or **Ask AI** (Ask AI opens a small window for your question).
2. **Limits:** When the app-wide monthly cap or your daily per-user cap is reached, you’ll see a “limit reached” message.

---

## Changing limits

Edit the constants in the Edge Function, then redeploy:

- **Monthly app cap:** `MONTHLY_REQUEST_CAP` in `supabase/functions/mistral/index.ts` (default 4000), or set the `MONTHLY_REQUEST_CAP` secret.
- **Daily per-user cap:** `DAILY_USER_CAP` in `supabase/functions/mistral/index.ts` (default 50).

Then:

```bash
npx supabase functions deploy mistral
```

---

## Legacy: Grammar & Translation (OpenAI / MyMemory)

The older **grammar** and **translate** Edge Functions (OpenAI + MyMemory) are still in the repo. The app now uses the **mistral** function for Define, Translate, and Ask AI. You can keep or remove the `grammar` and `translate` functions; the app does not call them for these features anymore.

- **Grammar (OpenAI):** `supabase/functions/grammar/index.ts` – 30 requests per user per day.
- **Translation (MyMemory):** `supabase/functions/translate/index.ts` – 100 per user per day.

If you want to use them again, deploy and set `OPENAI_API_KEY` and optionally `MYMEMORY_API_KEY` as above.

---

## Cost notes

- **Mistral:** Free tier has a monthly limit; the app-wide cap keeps you under it. Adjust `MONTHLY_REQUEST_CAP` to match the free tier (e.g. 4000 requests/month).
- **Supabase:** Edge Function invocations and the `app_usage` / `app_monthly_usage` tables are small; check your plan for limits.
