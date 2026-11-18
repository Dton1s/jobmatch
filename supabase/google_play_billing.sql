-- Google Play Billing entitlements and idempotent receipt ledger.
-- Run in the Supabase SQL editor before enabling native purchases.
begin;

create table if not exists public.jobmatch_google_play_purchases (
  purchase_token_hash text primary key,
  product_id text not null,
  purchase_type text not null check (purchase_type in ('subscription', 'offer_boost', 'worker_boost')),
  user_id uuid not null references public.jobmatch_profiles(id) on delete cascade,
  resource_id uuid,
  subscription_state text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobmatch_google_play_purchases enable row level security;
revoke all on public.jobmatch_google_play_purchases from anon, authenticated;
grant all on public.jobmatch_google_play_purchases to service_role;

create or replace function public.jobmatch_sync_pro_entitlement(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_stripe_end timestamptz;
  v_play_end timestamptz;
  v_expiry timestamptz;
begin
  select max(current_period_end) into v_stripe_end
  from public.jobmatch_subscriptions
  where company_id = p_user_id and status in ('active', 'trialing') and current_period_end > now();

  select max(expires_at) into v_play_end
  from public.jobmatch_google_play_purchases
  where user_id = p_user_id and purchase_type = 'subscription'
    and subscription_state in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED')
    and expires_at > now();

  select max(e.value) into v_expiry from unnest(array[v_stripe_end, v_play_end]) as e(value);
  update public.jobmatch_profiles set is_pro = v_expiry is not null and v_expiry > now(), pro_expires_at = v_expiry
  where id = p_user_id and role = 'company';
end;
$$;

create or replace function public.jobmatch_sync_pro_entitlement_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'jobmatch_subscriptions' then
    perform public.jobmatch_sync_pro_entitlement(new.company_id);
  else
    perform public.jobmatch_sync_pro_entitlement(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists jobmatch_subscriptions_sync_pro on public.jobmatch_subscriptions;
create trigger jobmatch_subscriptions_sync_pro
after insert or update on public.jobmatch_subscriptions
for each row execute function public.jobmatch_sync_pro_entitlement_trigger();

drop trigger if exists jobmatch_google_purchases_sync_pro on public.jobmatch_google_play_purchases;
create trigger jobmatch_google_purchases_sync_pro
after insert or update on public.jobmatch_google_play_purchases
for each row execute function public.jobmatch_sync_pro_entitlement_trigger();

revoke all on function public.jobmatch_sync_pro_entitlement(uuid) from public, anon, authenticated;
revoke all on function public.jobmatch_sync_pro_entitlement_trigger() from public, anon, authenticated;

create or replace function public.jobmatch_apply_google_play_purchase(
  p_purchase_token_hash text,
  p_product_id text,
  p_purchase_type text,
  p_user_id uuid,
  p_resource_id uuid default null,
  p_expiration timestamptz default null,
  p_subscription_state text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_inserted integer;
  v_existing public.jobmatch_google_play_purchases%rowtype;
begin
  if nullif(trim(p_purchase_token_hash), '') is null or length(p_purchase_token_hash) <> 64
    or nullif(trim(p_product_id), '') is null or p_user_id is null
    or p_purchase_type not in ('subscription', 'offer_boost', 'worker_boost') then
    raise exception 'Google Play purchase data is incomplete';
  end if;

  insert into public.jobmatch_google_play_purchases (
    purchase_token_hash, product_id, purchase_type, user_id, resource_id, subscription_state, expires_at
  ) values (
    p_purchase_token_hash, p_product_id, p_purchase_type, p_user_id, p_resource_id, p_subscription_state, p_expiration
  ) on conflict (purchase_token_hash) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select * into v_existing from public.jobmatch_google_play_purchases
      where purchase_token_hash = p_purchase_token_hash for update;
    if v_existing.user_id <> p_user_id or v_existing.product_id <> p_product_id
      or v_existing.purchase_type <> p_purchase_type
      or v_existing.resource_id is distinct from p_resource_id then
      raise exception 'Google Play purchase token is already linked to another account or product';
    end if;
    update public.jobmatch_google_play_purchases set
      subscription_state = coalesce(p_subscription_state, subscription_state),
      expires_at = coalesce(p_expiration, expires_at), updated_at = now()
    where purchase_token_hash = p_purchase_token_hash;
    if p_purchase_type <> 'subscription' then return false; end if;
  end if;

  if p_purchase_type = 'subscription' then
    if p_expiration is null or p_subscription_state is null then
      raise exception 'Google Play subscription status is incomplete';
    end if;
    if not exists (select 1 from public.jobmatch_profiles where id = p_user_id and role = 'company') then
      raise exception 'Company profile not found';
    end if;
  elsif p_purchase_type = 'offer_boost' then
    if p_resource_id is null then raise exception 'Boost offer id is required'; end if;
    update public.jobmatch_job_offers set
      is_boosted = true,
      boost_expires_at = greatest(coalesce(boost_expires_at, now()), now()) + interval '7 days'
    where id = p_resource_id and company_id = p_user_id and is_active and not is_demo and expires_at > now();
    if not found then raise exception 'Active offer not found or not owned by company'; end if;
  elsif p_purchase_type = 'worker_boost' then
    update public.jobmatch_worker_cards set
      is_boosted = true,
      boost_expires_at = greatest(coalesce(boost_expires_at, now()), now()) + interval '7 days'
    where id = p_resource_id and user_id = p_user_id and is_active and not is_demo;
    if not found then raise exception 'Active worker profile not found'; end if;
  end if;
  return true;
end;
$$;

revoke all on function public.jobmatch_apply_google_play_purchase(text,text,text,uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.jobmatch_apply_google_play_purchase(text,text,text,uuid,uuid,timestamptz,text) to service_role;

commit;
