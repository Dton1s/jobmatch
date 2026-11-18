alter table public.jobmatch_worker_cards
  add column if not exists languages text[] not null default '{}',
  add column if not exists education_level text not null default '';
