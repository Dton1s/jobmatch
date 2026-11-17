-- Límite del plan gratuito: tres ofertas activas por empresa.
-- Job Match Pro no tiene límite mientras su periodo esté vigente.
begin;

create or replace function public.jobmatch_enforce_free_offer_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_active_count integer;
begin
  if new.is_active is not true or new.is_demo is true or new.expires_at <= now() then
    return new;
  end if;

  if new.company_id is null then
    raise exception 'La oferta debe pertenecer a una empresa.' using errcode = '23514';
  end if;

  -- Serializa altas simultáneas de la misma empresa para que no se rebase el máximo.
  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 0));

  select coalesce(p.is_pro and p.pro_expires_at > now(), false)
    into v_is_pro
    from public.jobmatch_profiles p
   where p.id = new.company_id;

  if coalesce(v_is_pro, false) then
    return new;
  end if;

  select count(*)
    into v_active_count
    from public.jobmatch_job_offers o
   where o.company_id = new.company_id
     and o.is_active
     and not o.is_demo
     and o.expires_at > now()
     and o.id is distinct from new.id;

  if v_active_count >= 3 then
    raise exception 'free_offer_limit_reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists jobmatch_free_offer_limit on public.jobmatch_job_offers;
create trigger jobmatch_free_offer_limit
before insert or update of company_id, is_active, is_demo, expires_at
on public.jobmatch_job_offers
for each row execute function public.jobmatch_enforce_free_offer_limit();

commit;
