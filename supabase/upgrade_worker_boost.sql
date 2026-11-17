-- Impulso de perfil para fichas de trabajador.
-- Safe to apply repeatedly; entitlement changes are server/webhook only.
begin;

alter table public.jobmatch_worker_cards
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_expires_at timestamptz;

create index if not exists jobmatch_worker_cards_active_boost_idx
  on public.jobmatch_worker_cards (is_boosted, boost_expires_at desc, is_active, is_featured);

create or replace function public.jobmatch_block_client_worker_boost_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if tg_op = 'INSERT' and (new.is_boosted is distinct from false or new.boost_expires_at is not null) then
      raise exception 'Worker profile boosts are managed by billing';
    elsif tg_op = 'UPDATE' and (new.is_boosted is distinct from old.is_boosted or new.boost_expires_at is distinct from old.boost_expires_at) then
      raise exception 'Worker profile boosts are managed by billing';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobmatch_worker_cards_billing_guard on public.jobmatch_worker_cards;
create trigger jobmatch_worker_cards_billing_guard
before insert or update of is_boosted, boost_expires_at on public.jobmatch_worker_cards
for each row execute function public.jobmatch_block_client_worker_boost_changes();

create or replace function public.jobmatch_apply_worker_boost(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_payment_status text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_inserted integer;
begin
  if nullif(trim(p_event_id), '') is null
    or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
    or p_user_id is null
    or p_payment_status <> 'paid' then
    raise exception 'Paid worker boost checkout metadata is incomplete';
  end if;

  insert into public.jobmatch_stripe_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  update public.jobmatch_worker_cards
     set is_boosted = true, boost_expires_at = now() + interval '7 days'
   where user_id = p_user_id and is_demo = false;
  if not found then raise exception 'Worker profile not found'; end if;

  return true;
end;
$$;

revoke all on function public.jobmatch_apply_worker_boost(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.jobmatch_apply_worker_boost(text,text,uuid,text) to service_role;

commit;
