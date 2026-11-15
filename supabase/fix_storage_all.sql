-- JobMatch: acceso de usuarios autenticados al bucket jobmatch-media.
-- La política queda limitada al bucket indicado; no toca otros buckets ni tablas.
begin;

update storage.buckets
set allowed_mime_types = NULL,
    file_size_limit = 10485760
where id = 'jobmatch-media';

drop policy if exists jobmatch_media_public_read on storage.objects;
drop policy if exists jobmatch_media_upload_own_folder on storage.objects;
drop policy if exists jobmatch_media_update_own_folder on storage.objects;
drop policy if exists jobmatch_media_delete_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_select_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_upload_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_update_own_folder on storage.objects;
drop policy if exists jobmatch_media_cv_delete_own_folder on storage.objects;
drop policy if exists jobmatch_media_authenticated_select on storage.objects;
drop policy if exists jobmatch_media_authenticated_insert on storage.objects;
drop policy if exists jobmatch_media_authenticated_update on storage.objects;
drop policy if exists jobmatch_media_authenticated_delete on storage.objects;

create policy jobmatch_media_authenticated_select on storage.objects
for select to authenticated
using (bucket_id = 'jobmatch-media' and auth.role() = 'authenticated');

create policy jobmatch_media_authenticated_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'jobmatch-media' and auth.role() = 'authenticated');

create policy jobmatch_media_authenticated_update on storage.objects
for update to authenticated
using (bucket_id = 'jobmatch-media' and auth.role() = 'authenticated')
with check (bucket_id = 'jobmatch-media' and auth.role() = 'authenticated');

create policy jobmatch_media_authenticated_delete on storage.objects
for delete to authenticated
using (bucket_id = 'jobmatch-media' and auth.role() = 'authenticated');

commit;
