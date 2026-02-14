-- Global monthly usage for grammar (cap so app owner isn't charged past limit)
create table if not exists public.app_monthly_usage (
  month text not null primary key,
  grammar_total int not null default 0
);

alter table public.app_monthly_usage enable row level security;

-- Only the Edge Function (using service_role) should read/update this table
create policy "Service role only for app_monthly_usage"
  on public.app_monthly_usage
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

comment on table public.app_monthly_usage is 'Total grammar requests per month (app-wide cap). Updated by Edge Function with service role.';
