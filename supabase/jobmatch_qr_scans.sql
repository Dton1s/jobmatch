-- Optional, anonymous scan attribution for printed QR codes that point to /app.
-- Visitors can insert a scan row but cannot read or modify analytics data.
create table if not exists public.jobmatch_qr_scans (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'direct' check (char_length(source) between 1 and 120),
  platform text not null check (platform in ('android', 'ios', 'desktop')),
  user_agent text not null default '' check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

alter table public.jobmatch_qr_scans enable row level security;

drop policy if exists "jobmatch_qr_scans_anon_insert" on public.jobmatch_qr_scans;
create policy "jobmatch_qr_scans_anon_insert"
  on public.jobmatch_qr_scans
  for insert
  to anon, authenticated
  with check (
    char_length(source) between 1 and 120
    and platform in ('android', 'ios', 'desktop')
    and char_length(user_agent) <= 500
  );

revoke all on public.jobmatch_qr_scans from anon, authenticated;
grant insert on public.jobmatch_qr_scans to anon, authenticated;
