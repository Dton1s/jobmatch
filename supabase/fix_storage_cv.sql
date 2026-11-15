-- Repara la carga de CV en jobmatch-media usando el mismo formato de ruta
-- que los avatares y audios: {user_id}/cv-{uuid}-{nombre}.pdf.
-- Idempotente; no modifica tablas ni objetos ajenos a JobMatch.
begin;

update storage.buckets
set allowed_mime_types = array(
  select distinct mime_type
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['application/pdf']) as mime_type
)
where id = 'jobmatch-media';

-- La política global admite únicamente el primer segmento del usuario propietario.
-- Los PDF se limitan adicionalmente a 5 MB y a la nomenclatura cv-*.pdf.
drop policy if exists jobmatch_media_upload_own_folder on storage.objects;
create policy jobmatch_media_upload_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    coalesce(metadata->>'mimetype', '') <> 'application/pdf'
    or (
      lower(name) like '%/cv-%.pdf'
      and case
        when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint <= 5242880
        else false
      end
    )
  )
);

drop policy if exists jobmatch_media_update_own_folder on storage.objects;
create policy jobmatch_media_update_own_folder on storage.objects
for update to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    coalesce(metadata->>'mimetype', '') <> 'application/pdf'
    or (
      lower(name) like '%/cv-%.pdf'
      and case
        when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint <= 5242880
        else false
      end
    )
  )
);

-- Elimina las políticas antiguas que exigían una carpeta cv/{user_id}.
drop policy if exists jobmatch_media_cv_upload_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_update_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_delete_own_folder on storage.objects;

commit;
