-- Currículum PDF opcional, accesible desde el perfil Base y la ficha vinculada al match.
-- Solo modifica objetos con prefijo jobmatch_ y el bucket existente jobmatch-media.
begin;

alter table public.jobmatch_profiles
  add column if not exists cv_url text,
  add column if not exists cv_filename text;

alter table public.jobmatch_worker_cards
  add column if not exists cv_url text,
  add column if not exists cv_filename text;

-- El límite de 5 MB se aplica a los objetos PDF bajo cv/ mediante RLS y también
-- se valida en el formulario. Se conserva el límite global existente del bucket
-- para no afectar fotos y audio que ya utiliza la aplicación.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg','application/pdf']
where id = 'jobmatch-media';

drop policy if exists jobmatch_media_cv_upload_own_folder on storage.objects;
create policy jobmatch_media_cv_upload_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = 'cv'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and lower(name) like '%.pdf'
  and metadata->>'mimetype' = 'application/pdf'
  and case
    when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint <= 5242880
    else false
  end
);

drop policy if exists jobmatch_media_cv_update_own_folder on storage.objects;
create policy jobmatch_media_cv_update_own_folder on storage.objects
for update to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = 'cv'
  and (storage.foldername(name))[2] = (select auth.uid())::text
) with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = 'cv'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and lower(name) like '%.pdf'
  and metadata->>'mimetype' = 'application/pdf'
  and case
    when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint <= 5242880
    else false
  end
);

drop policy if exists jobmatch_media_cv_delete_own_folder on storage.objects;
create policy jobmatch_media_cv_delete_own_folder on storage.objects
for delete to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = 'cv'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

commit;
