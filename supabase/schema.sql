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
  enabled_roles text[] not null default '{}',
  display_name text not null default '',
  city text not null default '',
  lat double precision,
  lng double precision,
  avatar_path text,
  avatar_url text,
  full_name text not null default '',
  birth_year smallint,
  experience_years numeric(4,1) not null default 0,
  has_driving_license boolean not null default false,
  has_own_vehicle boolean not null default false,
  languages text[] not null default '{}',
  default_bio text not null default '',
  default_audio_url text,
  cv_url text,
  cv_filename text,
  company_name text not null default '',
  company_logo_url text,
  company_sector text not null default '',
  company_address text not null default '',
  company_description text not null default '',
  company_phone text not null default '',
  show_phone_on_match boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobmatch_profiles_lat_range check (lat is null or lat between -90 and 90),
  constraint jobmatch_profiles_lng_range check (lng is null or lng between -180 and 180),
  constraint jobmatch_profiles_birth_year_valid check (birth_year is null or birth_year between 1900 and 2100),
  constraint jobmatch_profiles_experience_nonnegative check (experience_years >= 0)
);

create table public.jobmatch_company_contacts (
  company_id uuid primary key references public.jobmatch_profiles(id) on delete cascade,
  phone text not null default '',
  visible_after_match boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.jobmatch_worker_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.jobmatch_profiles(id) on delete cascade,
  full_name text not null,
  age smallint check (age is null or age between 16 and 100),
  photo_path text,
  desired_position text not null,
  sector text not null,
  experience_years numeric(4,1) not null default 0 check (experience_years >= 0),
  availability public.jobmatch_availability not null,
  availability_note text not null default '',
  skills text[] not null default '{}',
  bio text not null default '',
  city text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  intro_audio_path text,
  cv_url text,
  cv_filename text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobmatch_job_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.jobmatch_profiles(id) on delete cascade,
  business_name text not null,
  business_image_path text,
  position text not null,
  sector text not null,
  salary_text text not null check (length(trim(salary_text)) > 0),
  salary_min numeric(10,2),
  salary_max numeric(10,2),
  salary_amount numeric(10,2) check (salary_amount is null or salary_amount >= 0),
  salary_frequency text not null default 'mensual' check (salary_frequency in ('mensual','hora','jornada')),
  salary_kind text not null default 'bruto' check (salary_kind in ('neto','bruto')),
  salary_period text not null default 'mensual',
  shift_type text not null,
  schedule text not null default '',
  benefits text[] not null default '{}',
  description text not null check (length(trim(description)) between 1 and 1200),
  city text not null,
  address_approx text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_active boolean not null default true,
  is_demo boolean not null default false,
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
  last_read_at_worker timestamptz,
  last_read_at_company timestamptz,
  created_at timestamptz not null default now(),
  constraint jobmatch_matches_one_pair unique (worker_card_id, job_offer_id),
  constraint jobmatch_matches_distinct_users check (worker_id <> company_id)
);

create table public.jobmatch_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.jobmatch_matches(id) on delete cascade,
  sender_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  message_type text not null default 'text' check (message_type in ('text','interview','interview_reply')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.jobmatch_card_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  worker_card_id uuid references public.jobmatch_worker_cards(id) on delete cascade,
  job_offer_id uuid references public.jobmatch_job_offers(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  constraint jobmatch_card_views_one_target check ((worker_card_id is null) <> (job_offer_id is null))
);

create index jobmatch_worker_cards_search_idx on public.jobmatch_worker_cards (is_active, sector, city);
create index jobmatch_job_offers_search_idx on public.jobmatch_job_offers (is_active, expires_at, sector, city);
create index jobmatch_swipes_target_idx on public.jobmatch_swipes (worker_card_id, job_offer_id, direction);
create index jobmatch_matches_worker_idx on public.jobmatch_matches (worker_id, created_at desc);
create index jobmatch_matches_company_idx on public.jobmatch_matches (company_id, created_at desc);
create index jobmatch_messages_match_created_idx on public.jobmatch_messages (match_id, created_at);
create index jobmatch_worker_cards_demo_idx on public.jobmatch_worker_cards (is_demo, is_active, sector);
create index jobmatch_job_offers_demo_idx on public.jobmatch_job_offers (is_demo, is_active, expires_at, sector);
create index jobmatch_messages_unread_idx on public.jobmatch_messages (match_id, read_at, created_at desc);
create index jobmatch_card_views_worker_idx on public.jobmatch_card_views (worker_card_id, viewed_at desc);
create index jobmatch_card_views_offer_idx on public.jobmatch_card_views (job_offer_id, viewed_at desc);
create unique index jobmatch_card_views_once_worker_idx on public.jobmatch_card_views (viewer_id, worker_card_id) where worker_card_id is not null;
create unique index jobmatch_card_views_once_offer_idx on public.jobmatch_card_views (viewer_id, job_offer_id) where job_offer_id is not null;

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

create or replace function public.jobmatch_role_is_enabled(p_user_id uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_role = any(p.enabled_roles), false)
  from public.jobmatch_profiles p where p.id = p_user_id;
$$;
revoke all on function public.jobmatch_role_is_enabled(uuid, text) from public;
grant execute on function public.jobmatch_role_is_enabled(uuid, text) to authenticated;

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

  select jo.company_id into v_company_id from public.jobmatch_job_offers jo where jo.id = new.job_offer_id;
  if v_company_id is null then return new; end if;

  if new.actor_role = 'company' then
    if new.actor_id <> v_company_id then return new; end if;
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc where wc.id = new.worker_card_id and not wc.is_demo;
    select exists (
      select 1 from public.jobmatch_swipes s
      where s.actor_role = 'worker' and s.actor_id = v_worker_id
        and s.worker_card_id = new.worker_card_id and s.job_offer_id = new.job_offer_id
        and s.direction = 'right'
    ) into v_mutual;
  else
    select wc.user_id into v_worker_id from public.jobmatch_worker_cards wc where wc.id = new.worker_card_id and wc.user_id = new.actor_id and not wc.is_demo;
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
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if exists (select 1 from public.jobmatch_matches where id = p_match_id and worker_id = v_user_id) then
    update public.jobmatch_matches set last_read_at_worker = now() where id = p_match_id;
  elsif exists (select 1 from public.jobmatch_matches where id = p_match_id and company_id = v_user_id) then
    update public.jobmatch_matches set last_read_at_company = now() where id = p_match_id;
  else
    raise exception 'match not found';
  end if;
  update public.jobmatch_messages set read_at = now()
  where match_id = p_match_id and sender_id <> v_user_id and read_at is null;
end;
$$;
revoke all on function public.jobmatch_mark_match_read(uuid) from public;
grant execute on function public.jobmatch_mark_match_read(uuid) to authenticated;

create trigger jobmatch_swipes_mutual_match after insert on public.jobmatch_swipes
for each row execute function public.jobmatch_create_match_on_mutual_interest();

alter table public.jobmatch_profiles enable row level security;
alter table public.jobmatch_company_contacts enable row level security;
alter table public.jobmatch_worker_cards enable row level security;
alter table public.jobmatch_job_offers enable row level security;
alter table public.jobmatch_swipes enable row level security;
alter table public.jobmatch_matches enable row level security;
alter table public.jobmatch_messages enable row level security;
alter table public.jobmatch_card_views enable row level security;

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

create policy jobmatch_company_contacts_select_authorized on public.jobmatch_company_contacts
for select to authenticated using (
  company_id = (select auth.uid()) or (
    visible_after_match and exists (
      select 1 from public.jobmatch_matches m
      where m.company_id = jobmatch_company_contacts.company_id and m.worker_id = (select auth.uid())
    )
  )
);
create policy jobmatch_company_contacts_insert_own on public.jobmatch_company_contacts
for insert to authenticated with check (company_id = (select auth.uid()));
create policy jobmatch_company_contacts_update_own on public.jobmatch_company_contacts
for update to authenticated using (company_id = (select auth.uid())) with check (company_id = (select auth.uid()));
create policy jobmatch_company_contacts_delete_own on public.jobmatch_company_contacts
for delete to authenticated using (company_id = (select auth.uid()));

create policy jobmatch_worker_cards_select_authenticated on public.jobmatch_worker_cards
for select to authenticated using (
  is_demo or user_id = (select auth.uid()) or (
    is_active and public.jobmatch_role_is_enabled(user_id, 'worker')
  ) or exists (
    select 1 from public.jobmatch_matches m
    where m.worker_card_id = jobmatch_worker_cards.id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);
create policy jobmatch_worker_cards_insert_self on public.jobmatch_worker_cards
for insert to authenticated with check (user_id = (select auth.uid()));
create policy jobmatch_worker_cards_update_self on public.jobmatch_worker_cards
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy jobmatch_worker_cards_delete_self on public.jobmatch_worker_cards
for delete to authenticated using (user_id = (select auth.uid()));

create policy jobmatch_job_offers_select_active on public.jobmatch_job_offers
for select to authenticated using (
  is_demo or company_id = (select auth.uid()) or (
    is_active and expires_at > now() and public.jobmatch_role_is_enabled(company_id, 'company')
  ) or exists (
    select 1 from public.jobmatch_matches m
    where m.job_offer_id = jobmatch_job_offers.id
      and (m.worker_id = (select auth.uid()) or m.company_id = (select auth.uid()))
  )
);
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
create policy jobmatch_swipes_delete_own on public.jobmatch_swipes
for delete to authenticated using (actor_id = (select auth.uid()));

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

create policy jobmatch_card_views_select_owner on public.jobmatch_card_views
for select to authenticated using (
  viewer_id = (select auth.uid()) or
  exists (select 1 from public.jobmatch_worker_cards wc where wc.id = worker_card_id and wc.user_id = (select auth.uid())) or
  exists (select 1 from public.jobmatch_job_offers jo where jo.id = job_offer_id and jo.company_id = (select auth.uid()))
);
create policy jobmatch_card_views_insert_self on public.jobmatch_card_views
for insert to authenticated with check (viewer_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jobmatch-media', 'jobmatch-media', true, 15728640, array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do update set public = true, file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg'];

update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg']
where id = 'jobmatch-media';

create policy jobmatch_media_public_read on storage.objects
for select to public using (bucket_id = 'jobmatch-media');
create policy jobmatch_media_upload_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) not like '%.pdf'
);
create policy jobmatch_media_update_own_folder on storage.objects
for update to authenticated using (bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (
  bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) not like '%.pdf'
);
create policy jobmatch_media_delete_own_folder on storage.objects
for delete to authenticated using (bucket_id = 'jobmatch-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jobmatch-cvs', 'jobmatch-cvs', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf'];

create policy jobmatch_cvs_select_owner_or_match on storage.objects
for select to authenticated using (
  bucket_id = 'jobmatch-cvs' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.jobmatch_matches m
      where coalesce(to_jsonb(m)->>'status', 'matched') = 'matched'
        and ((m.worker_id = (select auth.uid()) and m.company_id::text = (storage.foldername(name))[1])
          or (m.company_id = (select auth.uid()) and m.worker_id::text = (storage.foldername(name))[1]))
    )
  )
);
create policy jobmatch_cvs_insert_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) like '%.pdf'
);
create policy jobmatch_cvs_update_own_folder on storage.objects
for update to authenticated using (
  bucket_id = 'jobmatch-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'jobmatch-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) like '%.pdf'
);
create policy jobmatch_cvs_delete_own_folder on storage.objects
for delete to authenticated using (
  bucket_id = 'jobmatch-cvs' and (storage.foldername(name))[1] = (select auth.uid())::text
);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobmatch_matches') then
    alter publication supabase_realtime add table public.jobmatch_matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobmatch_messages') then
    alter publication supabase_realtime add table public.jobmatch_messages;
  end if;
end $$;

-- Monetization add-on; see upgrade_monetization.sql for incremental installs.
alter table public.jobmatch_profiles
  add column if not exists is_pro boolean not null default false,
  add column if not exists pro_expires_at timestamptz;

alter table public.jobmatch_job_offers
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_expires_at timestamptz;

alter table public.jobmatch_matches
  add column if not exists is_direct boolean not null default false;

create table if not exists public.jobmatch_subscriptions (
  company_id uuid primary key references public.jobmatch_profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete' check (status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobmatch_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists jobmatch_job_offers_active_boost_idx
  on public.jobmatch_job_offers (is_boosted, boost_expires_at desc, is_active, expires_at);

alter table public.jobmatch_subscriptions enable row level security;
alter table public.jobmatch_stripe_events enable row level security;

drop policy if exists jobmatch_subscriptions_select_owner on public.jobmatch_subscriptions;
create policy jobmatch_subscriptions_select_owner on public.jobmatch_subscriptions
for select to authenticated using (company_id = (select auth.uid()));

revoke all on public.jobmatch_subscriptions from anon, authenticated;
grant select on public.jobmatch_subscriptions to authenticated;
revoke all on public.jobmatch_stripe_events from anon, authenticated;
grant all on public.jobmatch_subscriptions, public.jobmatch_stripe_events to service_role;

create or replace function public.jobmatch_block_client_billing_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if tg_table_name = 'jobmatch_profiles' then
      if tg_op = 'INSERT' and (new.is_pro is distinct from false or new.pro_expires_at is not null) then
        raise exception 'Pro status is managed by billing';
      elsif tg_op = 'UPDATE' and (new.is_pro is distinct from old.is_pro or new.pro_expires_at is distinct from old.pro_expires_at) then
        raise exception 'Pro status is managed by billing';
      end if;
    elsif tg_table_name = 'jobmatch_job_offers' then
      if tg_op = 'INSERT' and (new.is_boosted is distinct from false or new.boost_expires_at is not null) then
        raise exception 'Offer boosts are managed by billing';
      elsif tg_op = 'UPDATE' and (new.is_boosted is distinct from old.is_boosted or new.boost_expires_at is distinct from old.boost_expires_at) then
        raise exception 'Offer boosts are managed by billing';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobmatch_profiles_billing_guard on public.jobmatch_profiles;
create trigger jobmatch_profiles_billing_guard
before insert or update of is_pro, pro_expires_at on public.jobmatch_profiles
for each row execute function public.jobmatch_block_client_billing_changes();

drop trigger if exists jobmatch_job_offers_billing_guard on public.jobmatch_job_offers;
create trigger jobmatch_job_offers_billing_guard
before insert or update of is_boosted, boost_expires_at on public.jobmatch_job_offers
for each row execute function public.jobmatch_block_client_billing_changes();

create or replace function public.jobmatch_process_stripe_event(
  p_event_id text,
  p_event_type text,
  p_mode text,
  p_company_id uuid,
  p_offer_id uuid default null,
  p_customer_id text default null,
  p_subscription_id text default null,
  p_subscription_status text default null,
  p_period_end timestamptz default null,
  p_payment_status text default null,
  p_cancel_at_period_end boolean default false
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_inserted integer;
  v_is_pro boolean;
begin
  if nullif(trim(p_event_id), '') is null or nullif(trim(p_event_type), '') is null then
    raise exception 'Stripe event id and type are required';
  end if;

  insert into public.jobmatch_stripe_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  if p_mode = 'payment' and p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    if p_payment_status <> 'paid' or p_company_id is null or p_offer_id is null then
      raise exception 'Paid Boost checkout metadata is incomplete';
    end if;
    update public.jobmatch_job_offers
       set is_boosted = true, boost_expires_at = now() + interval '7 days'
     where id = p_offer_id and company_id = p_company_id and is_demo = false;
    if not found then raise exception 'Boost offer not found or not owned by company'; end if;
  elsif p_mode = 'subscription' and p_event_type in (
    'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
    'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'
  ) then
    if p_company_id is null or p_subscription_id is null or p_subscription_status is null then
      raise exception 'Subscription event metadata is incomplete';
    end if;
    v_is_pro := p_subscription_status in ('active', 'trialing') and p_period_end is not null and p_period_end > now();
    insert into public.jobmatch_subscriptions (
      company_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, updated_at
    ) values (
      p_company_id, p_customer_id, p_subscription_id, p_subscription_status, p_period_end, coalesce(p_cancel_at_period_end, false), now()
    ) on conflict (company_id) do update set
      stripe_customer_id = coalesce(excluded.stripe_customer_id, public.jobmatch_subscriptions.stripe_customer_id),
      stripe_subscription_id = excluded.stripe_subscription_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = now();
    update public.jobmatch_profiles
       set is_pro = v_is_pro, pro_expires_at = p_period_end
     where id = p_company_id;
    if not found then raise exception 'Company profile not found'; end if;
  else
    -- Unrelated Stripe events are acknowledged and deduplicated without changing entitlements.
    return true;
  end if;

  return true;
end;
$$;
revoke all on function public.jobmatch_process_stripe_event(text,text,text,uuid,uuid,text,text,text,timestamptz,text,boolean) from public, anon, authenticated;
grant execute on function public.jobmatch_process_stripe_event(text,text,text,uuid,uuid,text,text,text,timestamptz,text,boolean) to service_role;

create or replace function public.jobmatch_start_pro_chat(p_worker_card_id uuid, p_job_offer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_company_id uuid := auth.uid();
  v_worker_id uuid;
  v_offer_company_id uuid;
  v_match_id uuid;
begin
  if v_company_id is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.jobmatch_profiles p
    where p.id = v_company_id and p.role = 'company' and 'company' = any(p.enabled_roles)
      and p.is_pro and p.pro_expires_at > now()
  ) then raise exception 'An active JobMatch Pro subscription is required'; end if;

  select jo.company_id into v_offer_company_id
  from public.jobmatch_job_offers jo
  where jo.id = p_job_offer_id and jo.is_active and jo.expires_at > now() and not jo.is_demo;
  if v_offer_company_id is distinct from v_company_id then raise exception 'Active company offer not found'; end if;

  select wc.user_id into v_worker_id
  from public.jobmatch_worker_cards wc
  where wc.id = p_worker_card_id and wc.is_active and not wc.is_demo
    and wc.user_id is not null and wc.user_id <> v_company_id
    and public.jobmatch_role_is_enabled(wc.user_id, 'worker');
  if v_worker_id is null then raise exception 'Candidate profile is not available'; end if;

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
