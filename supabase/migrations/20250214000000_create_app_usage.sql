-- Per-user daily usage for grammar and translation (backend proxy rate limits)
create table if not exists public.app_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  grammar_count int not null default 0,
  translation_count int not null default 0,
  primary key (user_id, date)
);

alter table public.app_usage enable row level security;

-- Users can only read/update their own usage row (drop first so migration is idempotent)
drop policy if exists "Users can read own usage" on public.app_usage;
create policy "Users can read own usage"
  on public.app_usage for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.app_usage;
create policy "Users can insert own usage"
  on public.app_usage for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.app_usage;
create policy "Users can update own usage"
  on public.app_usage for update
  using (auth.uid() = user_id);

comment on table public.app_usage is 'Daily API usage per user for rate limiting grammar and translation.';
