-- JobMatch monetization and direct company-to-candidate contact.
-- Safe to run more than once; preserves all existing rows.
begin;

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
