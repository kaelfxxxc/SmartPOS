-- Product photos captured while adding an unknown scanned barcode.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_member_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.has_business_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager','inventory_staff']::public.member_role[]
    )
  );

create policy product_images_member_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.has_business_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager','inventory_staff']::public.member_role[]
    )
  );

create policy product_images_member_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.has_business_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager','inventory_staff']::public.member_role[]
    )
  );

commit;
