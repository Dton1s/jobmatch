-- Anonymous scan attribution for /app. Stores only campaign source and broad platform.
create table if not exists public.jobmatch_qr_scans (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'direct' check (char_length(source) between 1 and 120),
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now()
);

alter table public.jobmatch_qr_scans enable row level security;

drop policy if exists "jobmatch_qr_scans_anon_insert" on public.jobmatch_qr_scans;
alter table public.jobmatch_qr_scans drop constraint if exists jobmatch_qr_scans_platform_check;
alter table public.jobmatch_qr_scans drop constraint if exists jobmatch_qr_scans_user_agent_check;
alter table public.jobmatch_qr_scans drop column if exists user_agent;
update public.jobmatch_qr_scans set platform = 'web' where platform = 'desktop';
alter table public.jobmatch_qr_scans add constraint jobmatch_qr_scans_platform_check check (platform in ('android', 'ios', 'web'));
create policy "jobmatch_qr_scans_anon_insert"
  on public.jobmatch_qr_scans
  for insert
  to anon, authenticated
  with check (
    char_length(source) between 1 and 120
    and platform in ('android', 'ios', 'web')
  );

revoke all on public.jobmatch_qr_scans from anon, authenticated;
grant insert on public.jobmatch_qr_scans to anon, authenticated;
