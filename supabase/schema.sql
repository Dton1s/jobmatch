-- JobMatch schema. All application objects are prefixed jobmatch_.
-- Safe to run alongside other projects in the same Supabase instance.
begin;

create extension if not exists pgcrypto with schema extensions;

create type public.jobmatch_role as enum ('worker', 'company');
create type public.jobmatch_availability as enum ('inmediata', 'fines_de_semana', 'media_jornada', 'completa');
create type public.jobmatch_swipe_direction as enum ('left', 'right', 'super');

create table public.jobmatch_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.jobmatch_role,
  display_name text not null default '',
  city text not null default '',
  lat double precision,
  lng double precision,
  avatar_path text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobmatch_profiles_lat_range check (lat is null or lat between -90 and 90),
  constraint jobmatch_profiles_lng_range check (lng is null or lng between -180 and 180)
);

create table public.jobmatch_worker_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.jobmatch_profiles(id) on delete cascade,
  full_name text not null,
  photo_path text,
  desired_position text not null,
  sector text not null,
  experience_years numeric(4,1) not null default 0 check (experience_years >= 0),
  availability public.jobmatch_availability not null,
  skills text[] not null default '{}',
  city text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  intro_audio_path text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobmatch_job_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  business_name text not null,
  business_image_path text,
  position text not null,
  sector text not null,
  salary_text text not null check (length(trim(salary_text)) > 0),
  salary_min numeric(10,2),
  salary_max numeric(10,2),
  salary_period text not null default 'mensual',
  shift_type text not null,
  description text not null check (length(trim(description)) between 1 and 1200),
  city text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_active boolean not null default true,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobmatch_job_offers_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min)
);

create table public.jobmatch_swipes (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  actor_role public.jobmatch_role not null,
  worker_card_id uuid not null references public.jobmatch_worker_cards(id) on delete cascade,
  job_offer_id uuid not null references public.jobmatch_job_offers(id) on delete cascade,
  direction public.jobmatch_swipe_direction not null,
  created_at timestamptz not null default now(),
  constraint jobmatch_swipes_one_decision unique (actor_id, worker_card_id, job_offer_id),
  constraint jobmatch_swipes_role_target check (
    (actor_role = 'worker' and direction <> 'super') or actor_role = 'company'
  )
);

create table public.jobmatch_matches (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  company_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  worker_card_id uuid not null references public.jobmatch_worker_cards(id) on delete cascade,
  job_offer_id uuid not null references public.jobmatch_job_offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint jobmatch_matches_one_pair unique (worker_card_id, job_offer_id),
  constraint jobmatch_matches_distinct_users check (worker_id <> company_id)
);

create table public.jobmatch_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.jobmatch_matches(id) on delete cascade,
  sender_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index jobmatch_worker_cards_search_idx on public.jobmatch_worker_cards (is_active, sector, city);
create index jobmatch_job_offers_search_idx on public.jobmatch_job_offers (is_active, expires_at, sector, city);
create index jobmatch_swipes_target_idx on public.jobmatch_swipes (worker_card_id, job_offer_id, direction);
create index jobmatch_matches_worker_idx on public.jobmatch_matches (worker_id, created_at desc);
create index jobmatch_matches_company_idx on public.jobmatch_matches (company_id, created_at desc);
create index jobmatch_messages_match_created_idx on public.jobmatch_messages (match_id, created_at);

create or replace function public.jobmatch_distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable strict parallel safe
set search_path = ''
as $$
  select 6371.0088 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.jobmatch_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jobmatch_profiles_updated_at before update on public.jobmatch_profiles
for each row execute function public.jobmatch_set_updated_at();
create trigger jobmatch_worker_cards_updated_at before update on public.jobmatch_worker_cards
for each row execute function public.jobmatch_set_updated_at();
create trigger jobmatch_job_offers_updated_at before update on public.jobmatch_job_offers
for each row execute function public.jobmatch_set_updated_at();

create or replace function public.jobmatch_create_match_on_mutual_interest()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
  v_mutual boolean;
begin
  if new.direction not in ('right', 'super') then return new; end if;

  if new.actor_role = 'company' then
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc where wc.id = new.worker_card_id;
    v_company_id := new.actor_id;
    select exists (
      select 1 from public.jobmatch_swipes s
      where s.actor_role = 'worker' and s.actor_id = v_worker_id
        and s.worker_card_id = new.worker_card_id and s.job_offer_id = new.job_offer_id
        and s.direction = 'right'
    ) into v_mutual;
  else
    v_worker_id := new.actor_id;
    select jo.company_id into v_company_id from public.jobmatch_job_offers jo where jo.id = new.job_offer_id;
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

create trigger jobmatch_swipes_mutual_match after insert on public.jobmatch_swipes
for each row execute function public.jobmatch_create_match_on_mutual_interest();

alter table public.jobmatch_profiles enable row level security;
alter table public.jobmatch_worker_cards enable row level security;
alter table public.jobmatch_job_offers enable row level security;
alter table public.jobmatch_swipes enable row level security;
alter table public.jobmatch_matches enable row level security;
alter table public.jobmatch_messages enable row level security;

create policy jobmatch_profiles_select_authenticated on public.jobmatch_profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.jobmatch_matches m
    where (m.worker_id = (select auth.uid()) and m.company_id = id)
       or (m.company_id = (select auth.uid()) and m.worker_id = id)
  )
);
create policy jobmatch_profiles_insert_self on public.jobmatch_profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy jobmatch_profiles_update_self on public.jobmatch_profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards
for select to authenticated using (is_active or user_id = (select auth.uid()));
create policy jobmatch_worker_cards_insert_self on public.jobmatch_worker_cards
for insert to authenticated with check (user_id = (select auth.uid()));
create policy jobmatch_worker_cards_update_self on public.jobmatch_worker_cards
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy jobmatch_worker_cards_delete_self on public.jobmatch_worker_cards
for delete to authenticated using (user_id = (select auth.uid()));

create policy jobmatch_job_offers_select_active on public.jobmatch_job_offers
for select to authenticated using ((is_active and expires_at > now()) or company_id = (select auth.uid()));
create policy jobmatch_job_offers_insert_company on public.jobmatch_job_offers
for insert to authenticated with check (company_id = (select auth.uid()));
create policy jobmatch_job_offers_update_company on public.jobmatch_job_offers
for update to authenticated using (company_id = (select auth.uid())) with check (company_id = (select auth.uid()));
create policy jobmatch_job_offers_delete_company on public.jobmatch_job_offers
for delete to authenticated using (company_id = (select auth.uid()));

create policy jobmatch_swipes_select_participant on public.jobmatch_swipes
for select to authenticated using (
  actor_id = (select auth.uid()) or
  exists (select 1 from public.jobmatch_worker_cards wc where wc.id = worker_card_id and wc.user_id = (select auth.uid())) or
  exists (select 1 from public.jobmatch_job_offers jo where jo.id = job_offer_id and jo.company_id = (select auth.uid()))
);
create policy jobmatch_swipes_insert_self on public.jobmatch_swipes
for insert to authenticated with check (
  actor_id = (select auth.uid()) and (
    (actor_role = 'worker' and exists (select 1 from public.jobmatch_worker_cards wc where wc.id = worker_card_id and wc.user_id = (select auth.uid())) and direction <> 'super') or
    (actor_role = 'company' and exists (select 1 from public.jobmatch_job_offers jo where jo.id = job_offer_id and jo.company_id = (select auth.uid())))
  )
);

create policy jobmatch_matches_select_participant on public.jobmatch_matches
for select to authenticated using (worker_id = (select auth.uid()) or company_id = (select auth.uid()));

create policy jobmatch_messages_select_match_participant on public.jobmatch_messages
for select to authenticated using (
  exists (select 1 from public.jobmatch_matches m where m.id = match_id and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid())))
);
create policy jobmatch_messages_insert_match_participant on public.jobmatch_messages
for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.jobmatch_matches m where m.id = match_id and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jobmatch-media', 'jobmatch-media', true, 15728640, array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do nothing;

create policy jobmatch_media_public_read on storage.objects
for select to authenticated using (bucket_id = 'jobmatch-media');
create policy jobmatch_media_upload_own_folder on storage.objects
for insert to authenticated with check (bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy jobmatch_media_update_own_folder on storage.objects
for update to authenticated using (bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy jobmatch_media_delete_own_folder on storage.objects
for delete to authenticated using (bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobmatch_matches') then
    alter publication supabase_realtime add table public.jobmatch_matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobmatch_messages') then
    alter publication supabase_realtime add table public.jobmatch_messages;
  end if;
end $$;

commit;
