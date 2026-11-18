-- Elimina únicamente las fichas y ofertas creadas por seed_demo.sql.
-- Las filas ficticias se identifican por is_demo=true; no se usa nombre, fecha ni ciudad.
-- Las FK ON DELETE CASCADE retiran exclusivamente sus swipes, vistas, matches y mensajes.
-- No elimina filas de jobmatch_profiles ni cuentas de auth.users.
begin;

do $$
declare
  v_workers bigint;
  v_offers bigint;
begin
  delete from public.jobmatch_worker_cards where is_demo is true;
  get diagnostics v_workers = row_count;

  delete from public.jobmatch_job_offers where is_demo is true;
  get diagnostics v_offers = row_count;

  raise notice 'Limpieza demo: % fichas de trabajador y % ofertas ficticias eliminadas. Relaciones dependientes se borraron por cascada.', v_workers, v_offers;
end;
$$;

commit;
