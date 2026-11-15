-- Storage seguro de currículums JobMatch. Limita cambios al bucket jobmatch-cvs
-- y a los objetos del bucket compartido jobmatch-media.
-- jobmatch_matches no tiene columna status en el esquema actual: la fila es el
-- registro del match confirmado. Si se añade status, solo se acepta 'matched'.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jobmatch-cvs', 'jobmatch-cvs', false, 5242880, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf'];

update storage.buckets
set public = true,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg']
where id = 'jobmatch-media';

-- El bucket público conserva lectura pública para avatares, logos y audios,
-- pero nunca acepta nuevas subidas de PDF.
drop policy if exists jobmatch_media_public_read on storage.objects;
drop policy if exists jobmatch_media_authenticated_select on storage.objects;
drop policy if exists jobmatch_media_upload_own_folder on storage.objects;
drop policy if exists jobmatch_media_update_own_folder on storage.objects;
drop policy if exists jobmatch_media_delete_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_select_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_upload_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_update_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_delete_own_folder on storage.objects;
drop policy if exists jobmatch_media_authenticated_insert on storage.objects;
drop policy if exists jobmatch_media_authenticated_update on storage.objects;
drop policy if exists jobmatch_media_authenticated_delete on storage.objects;

create policy jobmatch_media_public_read on storage.objects
for select to public using (bucket_id = 'jobmatch-media');

create policy jobmatch_media_upload_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) not like '%.pdf'
);

create policy jobmatch_media_update_own_folder on storage.objects
for update to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) not like '%.pdf'
);

create policy jobmatch_media_delete_own_folder on storage.objects
for delete to authenticated using (
  bucket_id = 'jobmatch-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists jobmatch_cvs_select_owner_or_match on storage.objects;
drop policy if exists jobmatch_cvs_insert_own_folder on storage.objects;
drop policy if exists jobmatch_cvs_update_own_folder on storage.objects;
drop policy if exists jobmatch_cvs_delete_own_folder on storage.objects;

create policy jobmatch_cvs_select_owner_or_match on storage.objects
for select to authenticated using (
  bucket_id = 'jobmatch-cvs'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.jobmatch_matches m
      where coalesce(to_jsonb(m)->>'status', 'matched') = 'matched'
        and (
          (m.worker_id = (select auth.uid()) and m.company_id::text = (storage.foldername(name))[1])
          or
          (m.company_id = (select auth.uid()) and m.worker_id::text = (storage.foldername(name))[1])
        )
    )
  )
);

-- Storage valida el MIME y el tamaño con allowed_mime_types/file_size_limit.
-- metadata puede llegar NULL durante WITH CHECK, así que RLS no debe depender de él.
create policy jobmatch_cvs_insert_own_folder on storage.objects
for insert to authenticated with check (
  bucket_id = 'jobmatch-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) like '%.pdf'
);

create policy jobmatch_cvs_update_own_folder on storage.objects
for update to authenticated using (
  bucket_id = 'jobmatch-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'jobmatch-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(name) like '%.pdf'
);

create policy jobmatch_cvs_delete_own_folder on storage.objects
for delete to authenticated using (
  bucket_id = 'jobmatch-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
