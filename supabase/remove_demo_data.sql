-- Elimina únicamente fichas y ofertas marcadas explícitamente como demostración.
-- Las relaciones dependientes se eliminan mediante las FK con ON DELETE CASCADE.
begin;

delete from public.jobmatch_job_offers where is_demo = true;
delete from public.jobmatch_worker_cards where is_demo = true;

commit;
