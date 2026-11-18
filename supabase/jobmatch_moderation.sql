-- Job Match UGC moderation and block enforcement.
-- Run once in Supabase SQL Editor against the production project before release.
begin;

create schema if not exists jobmatch_private;
revoke all on schema jobmatch_private from public, anon;
grant usage on schema jobmatch_private to authenticated;

create table if not exists public.jobmatch_user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  reported_user_id uuid references public.jobmatch_profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile','offer','message')),
  target_id uuid not null,
  reason text not null check (reason in ('contenido inapropiado','spam/estafa','oferta falsa','suplantación')),
  details text check (details is null or length(details) <= 1000),
  review_status text not null default 'pending' check (review_status in ('pending','reviewing','resolved','dismissed')),
  reviewed_at timestamptz,
  moderation_notes text check (moderation_notes is null or length(moderation_notes) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.jobmatch_user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint jobmatch_user_blocks_no_self check (blocker_id <> blocked_user_id),
  constraint jobmatch_user_blocks_unique_pair unique (blocker_id, blocked_user_id)
);

create table if not exists public.jobmatch_community_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  document_version text not null,
  content_type text not null check (content_type in ('worker_profile','job_offer')),
  accepted_at timestamptz not null default now()
);

create index if not exists jobmatch_user_reports_reporter_created_idx
  on public.jobmatch_user_reports (reporter_id, created_at desc);
create index if not exists jobmatch_user_reports_target_idx
  on public.jobmatch_user_reports (target_type, target_id);
create index if not exists jobmatch_user_reports_review_queue_idx
  on public.jobmatch_user_reports (review_status, created_at) where review_status = 'pending';
create index if not exists jobmatch_user_blocks_blocker_idx
  on public.jobmatch_user_blocks (blocker_id, blocked_user_id);
create index if not exists jobmatch_user_blocks_blocked_idx
  on public.jobmatch_user_blocks (blocked_user_id, blocker_id);

alter table public.jobmatch_user_reports enable row level security;
alter table public.jobmatch_user_blocks enable row level security;
alter table public.jobmatch_community_acceptances enable row level security;
revoke all on public.jobmatch_user_reports, public.jobmatch_user_blocks, public.jobmatch_community_acceptances from public, anon;
revoke all on public.jobmatch_user_reports from authenticated;
grant select (reporter_id, reported_user_id, target_type, target_id, reason, details, created_at)
  on public.jobmatch_user_reports to authenticated;
grant insert (reporter_id, reported_user_id, target_type, target_id, reason, details)
  on public.jobmatch_user_reports to authenticated;
grant select, insert, delete on public.jobmatch_user_blocks to authenticated;
grant select on public.jobmatch_community_acceptances to authenticated;
grant insert (user_id, document_version, content_type) on public.jobmatch_community_acceptances to authenticated;

drop policy if exists jobmatch_user_reports_insert_self on public.jobmatch_user_reports;
create policy jobmatch_user_reports_insert_self on public.jobmatch_user_reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and reported_user_id is distinct from (select auth.uid())
  );
drop policy if exists jobmatch_user_reports_select_self on public.jobmatch_user_reports;
create policy jobmatch_user_reports_select_self on public.jobmatch_user_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

drop policy if exists jobmatch_user_blocks_select_own on public.jobmatch_user_blocks;
create policy jobmatch_user_blocks_select_own on public.jobmatch_user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists jobmatch_user_blocks_insert_own on public.jobmatch_user_blocks;
create policy jobmatch_user_blocks_insert_own on public.jobmatch_user_blocks
  for insert to authenticated with check (
    blocker_id = (select auth.uid()) and blocked_user_id <> (select auth.uid())
  );
drop policy if exists jobmatch_user_blocks_delete_own on public.jobmatch_user_blocks;
create policy jobmatch_user_blocks_delete_own on public.jobmatch_user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists jobmatch_community_acceptances_select_own on public.jobmatch_community_acceptances;
create policy jobmatch_community_acceptances_select_own on public.jobmatch_community_acceptances
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists jobmatch_community_acceptances_insert_own on public.jobmatch_community_acceptances;
create policy jobmatch_community_acceptances_insert_own on public.jobmatch_community_acceptances
  for insert to authenticated with check (user_id = (select auth.uid()));

-- SECURITY DEFINER is needed so reciprocal blocks are enforced even though a user
-- cannot read another user's block list. It accepts only the counterpart ID.
create or replace function jobmatch_private.jobmatch_user_is_blocked(p_other_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and p_other_user_id is not null and exists (
    select 1 from public.jobmatch_user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_user_id = p_other_user_id)
       or (b.blocker_id = p_other_user_id and b.blocked_user_id = auth.uid())
  );
$$;
revoke all on function jobmatch_private.jobmatch_user_is_blocked(uuid) from public, anon;
grant execute on function jobmatch_private.jobmatch_user_is_blocked(uuid) to authenticated;

drop policy if exists jobmatch_profiles_select_authenticated on public.jobmatch_profiles;
create policy jobmatch_profiles_select_authenticated on public.jobmatch_profiles
  for select to authenticated using (
    id = (select auth.uid()) or (
      not jobmatch_private.jobmatch_user_is_blocked(id) and exists (
        select 1 from public.jobmatch_matches m
        where (m.worker_id = (select auth.uid()) and m.company_id = id)
           or (m.company_id = (select auth.uid()) and m.worker_id = id)
      )
    )
  );

drop policy if exists jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards;
create policy jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards
  for select to authenticated using (
    (is_demo or user_id = (select auth.uid()) or (
      is_active and public.jobmatch_role_is_enabled(user_id, 'worker')
    ) or exists (
      select 1 from public.jobmatch_matches m
      where m.worker_card_id = jobmatch_worker_cards.id
        and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
    )) and (user_id is null or user_id = (select auth.uid()) or not jobmatch_private.jobmatch_user_is_blocked(user_id))
  );

drop policy if exists jobmatch_job_offers_select_active on public.jobmatch_job_offers;
create policy jobmatch_job_offers_select_active on public.jobmatch_job_offers
  for select to authenticated using (
    (is_demo or company_id = (select auth.uid()) or (
      is_active and expires_at > now() and public.jobmatch_role_is_enabled(company_id, 'company')
    ) or exists (
      select 1 from public.jobmatch_matches m
      where m.job_offer_id = jobmatch_job_offers.id
        and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
    )) and (company_id is null or company_id = (select auth.uid()) or not jobmatch_private.jobmatch_user_is_blocked(company_id))
  );

drop policy if exists jobmatch_swipes_insert_self on public.jobmatch_swipes;
create policy jobmatch_swipes_insert_self on public.jobmatch_swipes
  for insert to authenticated with check (
    actor_id = (select auth.uid()) and (
      (actor_role = 'worker' and exists (
        select 1 from public.jobmatch_worker_cards wc
        join public.jobmatch_job_offers jo on jo.id = job_offer_id
        where wc.id = worker_card_id and wc.user_id = (select auth.uid())
          and not jobmatch_private.jobmatch_user_is_blocked(jo.company_id)
      ) and direction <> 'super') or
      (actor_role = 'company' and exists (
        select 1 from public.jobmatch_job_offers jo
        join public.jobmatch_worker_cards wc on wc.id = worker_card_id
        where jo.id = job_offer_id and jo.company_id = (select auth.uid())
          and not jobmatch_private.jobmatch_user_is_blocked(wc.user_id)
      ))
    )
  );

drop policy if exists jobmatch_matches_select_participant on public.jobmatch_matches;
create policy jobmatch_matches_select_participant on public.jobmatch_matches
  for select to authenticated using (
    (worker_id = (select auth.uid()) or company_id = (select auth.uid()))
    and not jobmatch_private.jobmatch_user_is_blocked(case when worker_id = (select auth.uid()) then company_id else worker_id end)
  );

drop policy if exists jobmatch_messages_select_match_participant on public.jobmatch_messages;
create policy jobmatch_messages_select_match_participant on public.jobmatch_messages
  for select to authenticated using (
    exists (select 1 from public.jobmatch_matches m where m.id = match_id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
      and not jobmatch_private.jobmatch_user_is_blocked(case when m.worker_id = (select auth.uid()) then m.company_id else m.worker_id end))
  );
drop policy if exists jobmatch_messages_insert_match_participant on public.jobmatch_messages;
create policy jobmatch_messages_insert_match_participant on public.jobmatch_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and exists (
      select 1 from public.jobmatch_matches m where m.id = match_id
        and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
        and not jobmatch_private.jobmatch_user_is_blocked(case when m.worker_id = (select auth.uid()) then m.company_id else m.worker_id end)
    )
  );

create or replace function public.jobmatch_create_match_on_mutual_interest()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
  v_mutual boolean;
begin
  if new.direction not in ('right', 'super') then return new; end if;
  select jo.company_id into v_company_id from public.jobmatch_job_offers jo where jo.id = new.job_offer_id;
  if v_company_id is null then return new; end if;
  if new.actor_role = 'company' then
    if new.actor_id <> v_company_id then return new; end if;
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc where wc.id = new.worker_card_id and not wc.is_demo;
    select exists (select 1 from public.jobmatch_swipes s where s.actor_role = 'worker' and s.actor_id = v_worker_id
      and s.worker_card_id = new.worker_card_id and s.job_offer_id = new.job_offer_id and s.direction = 'right') into v_mutual;
  else
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc where wc.id = new.worker_card_id and wc.user_id = new.actor_id and not wc.is_demo;
    select exists (select 1 from public.jobmatch_swipes s where s.actor_role = 'company' and s.actor_id = v_company_id
      and s.worker_card_id = new.worker_card_id and s.job_offer_id = new.job_offer_id and s.direction in ('right', 'super')) into v_mutual;
  end if;
  if exists (select 1 from public.jobmatch_user_blocks b where
       (b.blocker_id = v_worker_id and b.blocked_user_id = v_company_id)
       or (b.blocker_id = v_company_id and b.blocked_user_id = v_worker_id)) then return new; end if;
  if v_mutual and v_worker_id is not null and v_company_id is not null then
    insert into public.jobmatch_matches (worker_id, company_id, worker_card_id, job_offer_id)
    values (v_worker_id, v_company_id, new.worker_card_id, new.job_offer_id)
    on conflict (worker_card_id, job_offer_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.jobmatch_mark_match_read(p_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_other_user_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  select case when worker_id = v_user_id then company_id else worker_id end into v_other_user_id
    from public.jobmatch_matches where id = p_match_id and (worker_id = v_user_id or company_id = v_user_id);
  if not found then raise exception 'match not found'; end if;
  if exists (select 1 from public.jobmatch_user_blocks b where
       (b.blocker_id = v_user_id and b.blocked_user_id = v_other_user_id)
       or (b.blocker_id = v_other_user_id and b.blocked_user_id = v_user_id)) then raise exception 'chat unavailable'; end if;
  if exists (select 1 from public.jobmatch_matches where id = p_match_id and worker_id = v_user_id) then
    update public.jobmatch_matches set last_read_at_worker = now() where id = p_match_id;
  else
    update public.jobmatch_matches set last_read_at_company = now() where id = p_match_id;
  end if;
  update public.jobmatch_messages set read_at = now() where match_id = p_match_id and sender_id <> v_user_id and read_at is null;
end;
$$;
revoke all on function public.jobmatch_mark_match_read(uuid) from public, anon;
grant execute on function public.jobmatch_mark_match_read(uuid) to authenticated;

create or replace function public.jobmatch_start_pro_chat(p_worker_card_id uuid, p_job_offer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_company_id uuid := auth.uid();
  v_worker_id uuid;
  v_offer_company_id uuid;
  v_match_id uuid;
begin
  if v_company_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.jobmatch_profiles p where p.id = v_company_id and p.role = 'company'
    and 'company' = any(p.enabled_roles) and p.is_pro and p.pro_expires_at > now()) then
    raise exception 'An active JobMatch Pro subscription is required';
  end if;
  select jo.company_id into v_offer_company_id from public.jobmatch_job_offers jo
    where jo.id = p_job_offer_id and jo.is_active and jo.expires_at > now() and not jo.is_demo;
  if v_offer_company_id is distinct from v_company_id then raise exception 'Active company offer not found'; end if;
  select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc
    where wc.id = p_worker_card_id and wc.is_active and not wc.is_demo and wc.user_id is not null
      and wc.user_id <> v_company_id and public.jobmatch_role_is_enabled(wc.user_id, 'worker');
  if v_worker_id is null then raise exception 'Candidate profile is not available'; end if;
  if exists (select 1 from public.jobmatch_user_blocks b where
       (b.blocker_id = v_company_id and b.blocked_user_id = v_worker_id)
       or (b.blocker_id = v_worker_id and b.blocked_user_id = v_company_id)) then raise exception 'This user is blocked'; end if;
  insert into public.jobmatch_matches (worker_id, company_id, worker_card_id, job_offer_id, is_direct)
    values (v_worker_id, v_company_id, p_worker_card_id, p_job_offer_id, true)
    on conflict (worker_card_id, job_offer_id) do update set is_direct = public.jobmatch_matches.is_direct
    returning id into v_match_id;
  return v_match_id;
end;
$$;
revoke all on function public.jobmatch_start_pro_chat(uuid,uuid) from public, anon;
grant execute on function public.jobmatch_start_pro_chat(uuid,uuid) to authenticated;

commit;
