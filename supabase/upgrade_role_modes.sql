-- Roles habilitados y privacidad de fichas/ofertas cuando se desactiva un modo.
-- Solo modifica objetos JobMatch.
begin;

alter table public.jobmatch_profiles
  add column if not exists enabled_roles text[] not null default '{}';

update public.jobmatch_profiles
set enabled_roles = array[role::text]
where role is not null and cardinality(enabled_roles) = 0;

alter table public.jobmatch_profiles
  alter column enabled_roles set default '{}';

create or replace function public.jobmatch_role_is_enabled(p_user_id uuid, p_role text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(p_role = any(p.enabled_roles), false)
  from public.jobmatch_profiles p
  where p.id = p_user_id;
$$;
revoke all on function public.jobmatch_role_is_enabled(uuid, text) from public;
grant execute on function public.jobmatch_role_is_enabled(uuid, text) to authenticated;

drop policy if exists jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards;
create policy jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards
for select to authenticated using (
  is_demo
  or user_id = (select auth.uid())
  or (
    is_active and public.jobmatch_role_is_enabled(user_id, 'worker')
  )
  or exists (
    select 1 from public.jobmatch_matches m
    where m.worker_card_id = jobmatch_worker_cards.id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);

drop policy if exists jobmatch_job_offers_select_active on public.jobmatch_job_offers;
create policy jobmatch_job_offers_select_active on public.jobmatch_job_offers
for select to authenticated using (
  is_demo
  or company_id = (select auth.uid())
  or (
    is_active and expires_at > now() and public.jobmatch_role_is_enabled(company_id, 'company')
  )
  or exists (
    select 1 from public.jobmatch_matches m
    where m.job_offer_id = jobmatch_job_offers.id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);

commit;
