-- App-wide monthly usage for Mistral (overall limit so we never exceed free tier).
-- Only Edge Functions (service role) can read/write; no policies for anon/authenticated.
create table if not exists public.app_monthly_usage (
  month text not null primary key,
  total_requests int not null default 0,
  total_tokens int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.app_monthly_usage enable row level security;

-- No policies: only service role (used by Edge Functions) can access.
comment on table public.app_monthly_usage is 'App-wide Mistral usage per month; only backend can read/write.';

-- Add ask_count to per-user daily usage for "Ask AI" actions.
alter table public.app_usage
  add column if not exists ask_count int not null default 0;

comment on column public.app_usage.ask_count is 'Daily count of Ask AI (grammar/language) requests.';
