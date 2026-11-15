-- Permite gestionar los currículums PDF en jobmatch-media.
-- Ruta admitida: {auth.uid()}/cv-{timestamp}.pdf
-- Cada operación queda limitada a la carpeta del usuario autenticado.
begin;

update storage.buckets
set allowed_mime_types = array(
  select distinct allowed_mime
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['application/pdf']) as allowed(allowed_mime)
)
where id = 'jobmatch-media';

-- Inserción: mantiene el esquema de carpetas usado por avatar y audio y
-- aplica el límite de 5 MB para PDF.
drop policy if exists jobmatch_media_upload_own_folder on storage.objects;
create policy jobmatch_media_upload_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    coalesce(metadata->>'mimetype', '') <> 'application/pdf'
    or (
      lower(name) like '%/cv-%.pdf'
      and case when (metadata->>'size') ~ '^[0-9]+$'
        then (metadata->>'size')::bigint <= 5242880 else false end
    )
  )
);

-- Solo el propietario puede consultar objetos de su carpeta (el bucket es público,
-- así que los enlaces directos de PDF compartidos en un match siguen funcionando).
drop policy if exists jobmatch_media_cv_select_own_folder on storage.objects;
create policy jobmatch_media_cv_select_own_folder on storage.objects
for select to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) like '%/cv-%.pdf'
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
      and case when (metadata->>'size') ~ '^[0-9]+$'
        then (metadata->>'size')::bigint <= 5242880 else false end
    )
  )
);

drop policy if exists jobmatch_media_delete_own_folder on storage.objects;
create policy jobmatch_media_delete_own_folder on storage.objects
for delete to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Retira las políticas antiguas que exigían la ruta cv/{user_id}/....
drop policy if exists jobmatch_media_cv_upload_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_update_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_delete_own_folder on storage.objects;

commit;
