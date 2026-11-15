-- Ejecutar en Supabase SQL Editor. Solo elimina datos de JobMatch del usuario autenticado.
create or replace function public.jobmatch_delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para eliminar tu cuenta.' using errcode = '28000';
  end if;

  -- Borrar primero filas que apuntan a las fichas/ofertas del usuario.
  delete from public.jobmatch_messages m
  using public.jobmatch_matches mm
  where m.match_id = mm.id and (mm.worker_id = v_user_id or mm.company_id = v_user_id);

  delete from public.jobmatch_swipes s
  where s.actor_id = v_user_id
     or exists (select 1 from public.jobmatch_worker_cards wc where wc.id = s.worker_card_id and wc.user_id = v_user_id)
     or exists (select 1 from public.jobmatch_job_offers jo where jo.id = s.job_offer_id and jo.company_id = v_user_id);

  delete from public.jobmatch_card_views cv
  where cv.viewer_id = v_user_id
     or exists (select 1 from public.jobmatch_worker_cards wc where wc.id = cv.worker_card_id and wc.user_id = v_user_id)
     or exists (select 1 from public.jobmatch_job_offers jo where jo.id = cv.job_offer_id and jo.company_id = v_user_id);

  delete from public.jobmatch_matches where worker_id = v_user_id or company_id = v_user_id;
  delete from public.jobmatch_company_contacts where company_id = v_user_id;
  delete from public.jobmatch_worker_cards where user_id = v_user_id;
  delete from public.jobmatch_job_offers where company_id = v_user_id;
  delete from public.jobmatch_profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;

  if not found then
    raise exception 'No se encontró la cuenta autenticada.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.jobmatch_delete_my_account() from public;
revoke all on function public.jobmatch_delete_my_account() from anon;
grant execute on function public.jobmatch_delete_my_account() to authenticated;
