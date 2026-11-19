-- Job Match admin dashboard migration. Manual apply only; never run on unrelated schemas.
begin;

-- Stop collecting request headers/device fingerprints. Existing rows keep only source/platform.
create table if not exists public.jobmatch_qr_scans (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'direct',
  platform text not null,
  created_at timestamptz not null default now()
);
alter table public.jobmatch_qr_scans enable row level security;
drop policy if exists "jobmatch_qr_scans_anon_insert" on public.jobmatch_qr_scans;
alter table public.jobmatch_qr_scans drop constraint if exists jobmatch_qr_scans_platform_check;
alter table public.jobmatch_qr_scans drop constraint if exists jobmatch_qr_scans_source_length_check;
alter table public.jobmatch_qr_scans drop column if exists user_agent;
update public.jobmatch_qr_scans set platform = 'web' where platform = 'desktop';
alter table public.jobmatch_qr_scans add constraint jobmatch_qr_scans_platform_check check (platform in ('android','ios','web'));
alter table public.jobmatch_qr_scans add constraint jobmatch_qr_scans_source_length_check check (char_length(source) between 1 and 120);
revoke all on public.jobmatch_qr_scans from anon, authenticated;
grant insert (source, platform) on public.jobmatch_qr_scans to anon, authenticated;
create policy "jobmatch_qr_scans_anon_insert" on public.jobmatch_qr_scans
  for insert to anon, authenticated with check (char_length(source) between 1 and 120 and platform in ('android','ios','web'));

create table if not exists public.jobmatch_app_settings (
  key text primary key check (key in ('maintenance_notice','info_banner','feature_flags')),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.jobmatch_app_settings enable row level security;
revoke all on public.jobmatch_app_settings from public, anon, authenticated;
grant select, insert, update, delete on public.jobmatch_app_settings to service_role;

create table if not exists public.jobmatch_admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id text check (target_id is null or char_length(target_id) <= 120),
  result text not null check (result in ('success','denied','error')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists jobmatch_admin_audit_created_idx on public.jobmatch_admin_audit_logs(created_at desc);
alter table public.jobmatch_admin_audit_logs enable row level security;
revoke all on public.jobmatch_admin_audit_logs from public, anon, authenticated;
revoke update, delete, truncate, references, trigger on public.jobmatch_admin_audit_logs from service_role;
grant select, insert on public.jobmatch_admin_audit_logs to service_role;

create or replace function public.jobmatch_admin_audit_reject_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Job Match admin audit logs are append-only';
end;
$$;
drop trigger if exists jobmatch_admin_audit_append_only on public.jobmatch_admin_audit_logs;
create trigger jobmatch_admin_audit_append_only before update or delete on public.jobmatch_admin_audit_logs
for each row execute function public.jobmatch_admin_audit_reject_mutation();
revoke all on function public.jobmatch_admin_audit_reject_mutation() from public, anon, authenticated, service_role;

create or replace function public.jobmatch_admin_audit_append(
  p_admin_user_id uuid, p_action text, p_target_type text, p_target_id text, p_result text, p_notes text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_admin_user_id is null or p_action is null or p_target_type is null or p_result not in ('success','denied','error') then
    raise exception 'invalid audit record';
  end if;
  insert into public.jobmatch_admin_audit_logs(admin_user_id,action,target_type,target_id,result,notes)
  values(p_admin_user_id,left(p_action,80),left(p_target_type,40),left(p_target_id,120),p_result,left(p_notes,500));
end;
$$;
revoke all on function public.jobmatch_admin_audit_append(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.jobmatch_admin_audit_append(uuid,text,text,text,text,text) to service_role;

create or replace function public.jobmatch_admin_dashboard_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'range', jsonb_build_object('from',p_from,'to',p_to),
    'new_accounts', (select count(*) from auth.users u where u.created_at >= p_from and u.created_at < p_to),
    'active_worker_profiles', (select count(*) from public.jobmatch_worker_cards w where w.is_active),
    'active_offers', (select count(*) from public.jobmatch_job_offers o where o.is_active and o.expires_at > now()),
    'swipes', (select count(*) from public.jobmatch_swipes s where s.created_at >= p_from and s.created_at < p_to),
    'matches', (select count(*) from public.jobmatch_matches m where m.created_at >= p_from and m.created_at < p_to),
    'chats_with_messages', (select count(distinct msg.match_id) from public.jobmatch_messages msg where msg.created_at >= p_from and msg.created_at < p_to),
    'reports_pending', (select count(*) from public.jobmatch_user_reports r where r.review_status in ('pending','reviewing')),
    'reports_resolved', (select count(*) from public.jobmatch_user_reports r where r.review_status in ('resolved','dismissed') and r.reviewed_at >= p_from and r.reviewed_at < p_to),
    'pro_subscriptions', (select count(*) from public.jobmatch_subscriptions s where s.status in ('active','trialing') and s.current_period_end > now()),
    'google_play_purchases', (select count(*) from public.jobmatch_google_play_purchases p where p.created_at >= p_from and p.created_at < p_to),
    'qr_scans', coalesce((select jsonb_agg(jsonb_build_object('source',q.source,'platform',q.platform,'count',q.n)) from (
      select source,platform,count(*) as n from public.jobmatch_qr_scans where created_at >= p_from and created_at < p_to group by source,platform order by source,platform
    ) q),'[]'::jsonb)
  );
$$;
revoke all on function public.jobmatch_admin_dashboard_metrics(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.jobmatch_admin_dashboard_metrics(timestamptz,timestamptz) to service_role;

commit;
