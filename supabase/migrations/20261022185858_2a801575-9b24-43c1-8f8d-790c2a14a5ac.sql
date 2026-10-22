-- 1) As 4 políticas "deny" que na prática LIBERAM tudo
drop policy if exists fiscal_certificates_bucket_deny_select on storage.objects;
drop policy if exists fiscal_certificates_bucket_deny_write  on storage.objects;
drop policy if exists fiscal_certificates_bucket_deny_update on storage.objects;
drop policy if exists fiscal_certificates_bucket_deny_delete on storage.objects;

-- 2) product-media: upload/delete sem checar a empresa
drop policy if exists "Authenticated Upload for product-media" on storage.objects;
drop policy if exists "Authenticated Delete for product-media" on storage.objects;

-- 3) product-images: upload sem checar a pasta + política que nunca casa (pasta é companyId, não userId)
drop policy if exists "Authenticated Upload to product-images" on storage.objects;
drop policy if exists "Owner Access to product-images" on storage.objects;

-- 4) product-media com isolamento por empresa (pasta = companyId)
drop policy if exists product_media_insert on storage.objects;
drop policy if exists product_media_update on storage.objects;
drop policy if exists product_media_delete on storage.objects;

create policy product_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-media'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid));

create policy product_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-media'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'product-media'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid));

create policy product_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-media'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid));