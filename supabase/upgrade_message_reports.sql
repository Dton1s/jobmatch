-- Extend report reasons used by chat message reporting. Run in the Supabase SQL Editor.
begin;
alter table public.jobmatch_user_reports
  drop constraint if exists jobmatch_user_reports_reason_check;
alter table public.jobmatch_user_reports
  add constraint jobmatch_user_reports_reason_check
  check (reason in (
    'contenido inapropiado',
    'spam/estafa',
    'oferta falsa',
    'suplantación',
    'contenido ofensivo o acoso',
    'oferta o datos falsos',
    'otro motivo'
  ));
commit;
