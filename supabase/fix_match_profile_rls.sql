-- Permite a cada participante de un match leer los perfiles y la ficha vinculada.
-- El esquema JobMatch denomina company_id al lado empleador de jobmatch_matches.
begin;

alter table public.jobmatch_profiles enable row level security;
alter table public.jobmatch_worker_cards enable row level security;
alter table public.jobmatch_job_offers enable row level security;
alter table public.jobmatch_matches enable row level security;

drop policy if exists jobmatch_matches_select_participant on public.jobmatch_matches;
create policy jobmatch_matches_select_participant on public.jobmatch_matches
for select to authenticated using (
  worker_id = (select auth.uid()) or company_id = (select auth.uid())
);

drop policy if exists jobmatch_profiles_select_authenticated on public.jobmatch_profiles;
create policy jobmatch_profiles_select_authenticated on public.jobmatch_profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.jobmatch_matches m
    where (m.worker_id = (select auth.uid()) and m.company_id = jobmatch_profiles.id)
       or (m.company_id = (select auth.uid()) and m.worker_id = jobmatch_profiles.id)
       or (
         (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
         and (
           exists (select 1 from public.jobmatch_worker_cards wc where wc.id = m.worker_card_id and wc.user_id = jobmatch_profiles.id)
           or exists (select 1 from public.jobmatch_job_offers jo where jo.id = m.job_offer_id and jo.company_id = jobmatch_profiles.id)
         )
       )
  )
);

drop policy if exists jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards;
create policy jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards
for select to authenticated using (
  is_demo or is_active or user_id = (select auth.uid()) or exists (
    select 1 from public.jobmatch_matches m
    where m.worker_card_id = jobmatch_worker_cards.id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);

drop policy if exists jobmatch_job_offers_select_active on public.jobmatch_job_offers;
create policy jobmatch_job_offers_select_active on public.jobmatch_job_offers
for select to authenticated using (
  (is_active and expires_at > now()) or is_demo or company_id = (select auth.uid()) or exists (
    select 1 from public.jobmatch_matches m
    where m.job_offer_id = jobmatch_job_offers.id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);

commit;
