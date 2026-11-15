-- JobMatch Perfil Base v3. Idempotente; conserva y no reemplaza filas.
begin;

alter table public.jobmatch_profiles
  add column if not exists avatar_url text,
  add column if not exists full_name text not null default '',
  add column if not exists birth_year smallint,
  add column if not exists city text not null default '',
  add column if not exists experience_years numeric(4,1) not null default 0,
  add column if not exists has_driving_license boolean not null default false,
  add column if not exists has_own_vehicle boolean not null default false,
  add column if not exists languages text[] not null default '{}',
  add column if not exists default_bio text not null default '',
  add column if not exists default_audio_url text,
  add column if not exists company_name text not null default '',
  add column if not exists company_logo_url text,
  add column if not exists company_sector text not null default '',
  add column if not exists company_address text not null default '',
  add column if not exists company_description text not null default '',
  add column if not exists company_phone text not null default '',
  add column if not exists show_phone_on_match boolean not null default false;

create table if not exists public.jobmatch_company_contacts (
  company_id uuid primary key references public.jobmatch_profiles(id) on delete cascade,
  phone text not null default '',
  visible_after_match boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.jobmatch_profiles enable row level security;
alter table public.jobmatch_company_contacts enable row level security;

drop policy if exists jobmatch_profiles_select_authenticated on public.jobmatch_profiles;
create policy jobmatch_profiles_select_authenticated on public.jobmatch_profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.jobmatch_matches m
    where (m.worker_id = (select auth.uid()) and m.company_id = id)
       or (m.company_id = (select auth.uid()) and m.worker_id = id)
  )
);
drop policy if exists jobmatch_profiles_insert_self on public.jobmatch_profiles;
create policy jobmatch_profiles_insert_self on public.jobmatch_profiles
for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists jobmatch_profiles_update_self on public.jobmatch_profiles;
create policy jobmatch_profiles_update_self on public.jobmatch_profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists jobmatch_company_contacts_select_authorized on public.jobmatch_company_contacts;
create policy jobmatch_company_contacts_select_authorized on public.jobmatch_company_contacts
for select to authenticated using (
  company_id = (select auth.uid()) or (
    visible_after_match and exists (
      select 1 from public.jobmatch_matches m
      where m.company_id = jobmatch_company_contacts.company_id and m.worker_id = (select auth.uid())
    )
  )
);
drop policy if exists jobmatch_company_contacts_insert_own on public.jobmatch_company_contacts;
create policy jobmatch_company_contacts_insert_own on public.jobmatch_company_contacts
for insert to authenticated with check (company_id = (select auth.uid()));
drop policy if exists jobmatch_company_contacts_update_own on public.jobmatch_company_contacts;
create policy jobmatch_company_contacts_update_own on public.jobmatch_company_contacts
for update to authenticated using (company_id = (select auth.uid())) with check (company_id = (select auth.uid()));
drop policy if exists jobmatch_company_contacts_delete_own on public.jobmatch_company_contacts;
create policy jobmatch_company_contacts_delete_own on public.jobmatch_company_contacts
for delete to authenticated using (company_id = (select auth.uid()));

commit;
