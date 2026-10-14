-- Upgrade path for projects where the Phase 1 migration was already applied.
begin;

alter table public.profiles
  add column if not exists pending_business_name text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id, full_name, phone, pending_business_name,
    privacy_accepted_at, terms_accepted_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'business_name',
    (new.raw_user_meta_data->>'privacy_accepted_at')::timestamptz,
    (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;
