-- JobMatch v2: ampliación incremental, conserva todas las filas existentes.
-- Ejecutar después de schema.sql. Solo altera objetos jobmatch_*.
begin;

alter table public.jobmatch_worker_cards
  add column if not exists age smallint,
  add column if not exists bio text not null default '',
  add column if not exists availability_note text not null default '',
  add column if not exists is_demo boolean not null default false;
alter table public.jobmatch_worker_cards alter column user_id drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'jobmatch_worker_cards_age_range' and conrelid = 'public.jobmatch_worker_cards'::regclass) then
    alter table public.jobmatch_worker_cards add constraint jobmatch_worker_cards_age_range check (age is null or age between 16 and 100);
  end if;
end $$;

alter table public.jobmatch_job_offers
  add column if not exists salary_amount numeric(10,2),
  add column if not exists salary_frequency text not null default 'mensual',
  add column if not exists salary_kind text not null default 'bruto',
  add column if not exists schedule text not null default '',
  add column if not exists benefits text[] not null default '{}',
  add column if not exists address_approx text not null default '',
  add column if not exists is_demo boolean not null default false;
alter table public.jobmatch_job_offers alter column company_id drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'jobmatch_job_offers_salary_amount_positive' and conrelid = 'public.jobmatch_job_offers'::regclass) then
    alter table public.jobmatch_job_offers add constraint jobmatch_job_offers_salary_amount_positive check (salary_amount is null or salary_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobmatch_job_offers_salary_frequency_valid' and conrelid = 'public.jobmatch_job_offers'::regclass) then
    alter table public.jobmatch_job_offers add constraint jobmatch_job_offers_salary_frequency_valid check (salary_frequency in ('mensual','hora','jornada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobmatch_job_offers_salary_kind_valid' and conrelid = 'public.jobmatch_job_offers'::regclass) then
    alter table public.jobmatch_job_offers add constraint jobmatch_job_offers_salary_kind_valid check (salary_kind in ('neto','bruto'));
  end if;
end $$;

alter table public.jobmatch_matches
  add column if not exists last_read_at_worker timestamptz,
  add column if not exists last_read_at_company timestamptz;
alter table public.jobmatch_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'jobmatch_messages_type_valid' and conrelid = 'public.jobmatch_messages'::regclass) then
    alter table public.jobmatch_messages add constraint jobmatch_messages_type_valid check (message_type in ('text','interview','interview_reply'));
  end if;
end $$;

create table if not exists public.jobmatch_card_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  worker_card_id uuid references public.jobmatch_worker_cards(id) on delete cascade,
  job_offer_id uuid references public.jobmatch_job_offers(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  constraint jobmatch_card_views_one_target check ((worker_card_id is null) <> (job_offer_id is null))
);

create index if not exists jobmatch_worker_cards_demo_idx on public.jobmatch_worker_cards (is_demo, is_active, sector);
create index if not exists jobmatch_job_offers_demo_idx on public.jobmatch_job_offers (is_demo, is_active, expires_at, sector);
create index if not exists jobmatch_messages_unread_idx on public.jobmatch_messages (match_id, read_at, created_at desc);
create index if not exists jobmatch_card_views_worker_idx on public.jobmatch_card_views (worker_card_id, viewed_at desc);
create index if not exists jobmatch_card_views_offer_idx on public.jobmatch_card_views (job_offer_id, viewed_at desc);
create unique index if not exists jobmatch_card_views_once_worker_idx on public.jobmatch_card_views (viewer_id, worker_card_id) where worker_card_id is not null;
create unique index if not exists jobmatch_card_views_once_offer_idx on public.jobmatch_card_views (viewer_id, job_offer_id) where job_offer_id is not null;

drop policy if exists jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards;
create policy jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards
for select to authenticated using (is_demo or is_active or user_id = (select auth.uid()));
drop policy if exists jobmatch_job_offers_select_active on public.jobmatch_job_offers;
create policy jobmatch_job_offers_select_active on public.jobmatch_job_offers
for select to authenticated using ((is_active and expires_at > now()) or is_demo or company_id = (select auth.uid()));

create or replace function public.jobmatch_create_match_on_mutual_interest()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
  v_offer_company_id uuid;
  v_mutual boolean := false;
begin
  if new.direction not in ('right', 'super') then return new; end if;
  select jo.company_id into v_offer_company_id
  from public.jobmatch_job_offers jo where jo.id = new.job_offer_id;
  if v_offer_company_id is null then return new; end if;

  if new.actor_role = 'company' then
    if new.actor_id <> v_offer_company_id then return new; end if;
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc
    where wc.id = new.worker_card_id and not wc.is_demo;
    v_company_id := v_offer_company_id;
    select exists (
      select 1 from public.jobmatch_swipes s
      where s.actor_role = 'worker' and s.actor_id = v_worker_id
        and s.worker_card_id = new.worker_card_id and s.job_offer_id = new.job_offer_id
        and s.direction = 'right'
    ) into v_mutual;
  elsif new.actor_role = 'worker' then
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc
    where wc.id = new.worker_card_id and wc.user_id = new.actor_id and not wc.is_demo;
    v_company_id := v_offer_company_id;
    select exists (
      select 1 from public.jobmatch_swipes s
      where s.actor_role = 'company' and s.actor_id = v_company_id
        and s.worker_card_id = new.worker_card_id and s.job_offer_id = new.job_offer_id
        and s.direction in ('right', 'super')
    ) into v_mutual;
  end if;

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
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if exists (select 1 from public.jobmatch_matches where id = p_match_id and worker_id = v_user_id) then
    update public.jobmatch_matches set last_read_at_worker = now() where id = p_match_id;
  elsif exists (select 1 from public.jobmatch_matches where id = p_match_id and company_id = v_user_id) then
    update public.jobmatch_matches set last_read_at_company = now() where id = p_match_id;
  else raise exception 'match not found'; end if;
  update public.jobmatch_messages set read_at = now() where match_id = p_match_id and sender_id <> v_user_id and read_at is null;
end;
$$;
revoke all on function public.jobmatch_mark_match_read(uuid) from public;
grant execute on function public.jobmatch_mark_match_read(uuid) to authenticated;

drop policy if exists jobmatch_swipes_delete_own on public.jobmatch_swipes;
create policy jobmatch_swipes_delete_own on public.jobmatch_swipes
for delete to authenticated using (actor_id = (select auth.uid()));
alter table public.jobmatch_card_views enable row level security;
drop policy if exists jobmatch_card_views_select_owner on public.jobmatch_card_views;
create policy jobmatch_card_views_select_owner on public.jobmatch_card_views
for select to authenticated using (
  viewer_id = (select auth.uid()) or
  exists (select 1 from public.jobmatch_worker_cards wc where wc.id = worker_card_id and wc.user_id = (select auth.uid())) or
  exists (select 1 from public.jobmatch_job_offers jo where jo.id = job_offer_id and jo.company_id = (select auth.uid()))
);
drop policy if exists jobmatch_card_views_insert_self on public.jobmatch_card_views;
create policy jobmatch_card_views_insert_self on public.jobmatch_card_views
for insert to authenticated with check (viewer_id = (select auth.uid()));

commit;
