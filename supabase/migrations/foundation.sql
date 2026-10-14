-- SmartPOS: Phase 1 organization, permissions, catalog, and audit foundation.
-- Apply with the Supabase CLI or paste into the Supabase SQL editor.
begin;

create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'admin', 'manager', 'cashier', 'inventory_staff');
create type public.member_status as enum ('invited', 'active', 'suspended');
create type public.tax_mode as enum ('non_vat', 'vat_registered');
create type public.product_status as enum ('active', 'archived');
create type public.inventory_movement_type as enum (
  'initial_stock', 'purchase', 'sale', 'sale_return', 'damage',
  'expiration', 'adjustment', 'transfer_in', 'transfer_out'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  pending_business_name text,
  privacy_accepted_at timestamptz,
  terms_accepted_at timestamptz,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'fil')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  category text not null,
  address text not null,
  contact text not null,
  owner_user_id uuid not null references public.profiles(id),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  logo_path text,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  name text not null check (length(trim(name)) between 2 and 120),
  address text not null,
  contact text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references public.profiles(id),
  branch_id uuid references public.branches(id),
  role public.member_role not null,
  status public.member_status not null default 'invited',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, branch_id)
);

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  permission text not null,
  allowed boolean not null default true,
  unique (role_id, permission)
);

create table public.business_settings (
  business_id uuid primary key references public.businesses(id),
  tax_mode public.tax_mode not null default 'non_vat',
  vat_rate numeric(5,4) not null default 0.1200 check (vat_rate between 0 and 1),
  prices_include_tax boolean not null default true,
  tin text,
  registered_name text,
  trade_name text,
  receipt_mode text not null default 'internal' check (receipt_mode in ('internal', 'configured_invoice')),
  receipt_footer text not null default 'Thank you! Please come again.',
  receipt_prefix text not null default 'SALE',
  beginner_mode boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  name text not null,
  allocation_policy text not null default 'block_when_unallocated'
    check (allocation_policy in ('block_when_unallocated', 'allow_with_review')),
  authorized_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  category_id uuid references public.categories(id),
  sku text,
  name text not null check (length(trim(name)) > 0),
  description text,
  unit text not null default 'piece',
  cost_centavos bigint not null default 0 check (cost_centavos >= 0),
  price_centavos bigint not null check (price_centavos >= 0),
  wholesale_price_centavos bigint check (wholesale_price_centavos >= 0),
  tax_class text not null default 'non_vat'
    check (tax_class in ('standard', 'exempt', 'zero_rated', 'non_vat')),
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  image_path text,
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku)
);

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  product_id uuid not null references public.products(id),
  barcode text not null,
  format text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, barcode)
);

create table public.inventory_balances (
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  confirmed_quantity numeric(14,3) not null default 0,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_id, product_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  movement_type public.inventory_movement_type not null,
  quantity_change numeric(14,3) not null check (quantity_change <> 0),
  reason text,
  reference_type text,
  reference_id uuid,
  staff_user_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid references public.branches(id),
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_metadata jsonb,
  created_at timestamptz not null default now()
);

create index business_members_user_idx on public.business_members(user_id, status);
create index business_members_business_idx on public.business_members(business_id, role);
create index products_lookup_idx on public.products(business_id, status, name);
create index product_barcodes_lookup_idx on public.product_barcodes(business_id, barcode);
create index inventory_movements_history_idx on public.inventory_movements(branch_id, product_id, created_at desc);
create index audit_logs_business_time_idx on public.audit_logs(business_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger businesses_updated before update on public.businesses for each row execute function public.set_updated_at();
create trigger branches_updated before update on public.branches for each row execute function public.set_updated_at();
create trigger members_updated before update on public.business_members for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

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
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_business_role(p_business_id uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
      and status = 'active' and role = any(p_roles)
  );
$$;

create or replace function public.can_access_branch(p_business_id uuid, p_branch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and status = 'active'
      and (branch_id is null or branch_id = p_branch_id or role in ('owner', 'admin'))
  );
$$;

create or replace function public.create_business_with_owner(
  p_name text, p_category text, p_address text, p_contact text,
  p_owner_name text, p_branch_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_branch uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name)) < 2 or length(trim(p_branch_name)) < 2 then
    raise exception 'Invalid business details';
  end if;
  insert into public.profiles (id, full_name) values (v_user, trim(p_owner_name))
  on conflict (id) do update set full_name = excluded.full_name;
  insert into public.businesses (name, category, address, contact, owner_user_id)
  values (trim(p_name), p_category, trim(p_address), trim(p_contact), v_user)
  returning id into v_business;
  insert into public.branches (business_id, name, address, contact)
  values (v_business, trim(p_branch_name), trim(p_address), trim(p_contact))
  returning id into v_branch;
  insert into public.business_members (business_id, user_id, branch_id, role, status)
  values (v_business, v_user, null, 'owner', 'active');
  insert into public.business_settings (business_id) values (v_business);
  insert into public.audit_logs (business_id, branch_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (v_business, v_branch, v_user, 'business.created', 'business', v_business,
    jsonb_build_object('name', trim(p_name), 'category', p_category));
  return v_business;
end;
$$;
revoke all on function public.create_business_with_owner(text,text,text,text,text,text) from public;
grant execute on function public.create_business_with_owner(text,text,text,text,text,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.business_members enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.business_settings enable row level security;
alter table public.devices enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy businesses_member_select on public.businesses for select using (public.is_business_member(id));
create policy businesses_owner_update on public.businesses for update using (public.has_business_role(id, array['owner','admin']::public.member_role[]));
create policy branches_member_select on public.branches for select using (public.is_business_member(business_id));
create policy branches_admin_write on public.branches for all using (public.has_business_role(business_id, array['owner','admin']::public.member_role[]));
create policy members_business_select on public.business_members for select using (public.is_business_member(business_id));
create policy members_admin_write on public.business_members for all using (public.has_business_role(business_id, array['owner','admin']::public.member_role[]));
create policy settings_member_select on public.business_settings for select using (public.is_business_member(business_id));
create policy settings_owner_update on public.business_settings for update using (public.has_business_role(business_id, array['owner','admin']::public.member_role[]));
create policy roles_member_select on public.staff_roles for select using (public.is_business_member(business_id));
create policy roles_owner_write on public.staff_roles for all using (public.has_business_role(business_id, array['owner','admin']::public.member_role[]));
create policy permissions_member_select on public.staff_permissions for select using (
  exists (select 1 from public.staff_roles r where r.id = role_id and public.is_business_member(r.business_id))
);
create policy devices_member_select on public.devices for select using (public.is_business_member(business_id));
create policy devices_admin_write on public.devices for all using (public.has_business_role(business_id, array['owner','admin']::public.member_role[]));
create policy categories_member_select on public.categories for select using (public.is_business_member(business_id));
create policy categories_inventory_write on public.categories for all using (public.has_business_role(business_id, array['owner','admin','manager','inventory_staff']::public.member_role[]));
create policy products_member_select on public.products for select using (public.is_business_member(business_id));
create policy products_inventory_write on public.products for all using (public.has_business_role(business_id, array['owner','admin','manager','inventory_staff']::public.member_role[]));
create policy barcodes_member_select on public.product_barcodes for select using (public.is_business_member(business_id));
create policy barcodes_inventory_write on public.product_barcodes for all using (public.has_business_role(business_id, array['owner','admin','manager','inventory_staff']::public.member_role[]));
create policy balances_branch_select on public.inventory_balances for select using (public.can_access_branch(business_id, branch_id));
create policy movements_branch_select on public.inventory_movements for select using (public.can_access_branch(business_id, branch_id));
create policy audit_owner_select on public.audit_logs for select using (public.has_business_role(business_id, array['owner','admin']::public.member_role[]));

-- Financial and stock writes intentionally have no direct client insert policies.
-- Phase 2 transaction functions will own those writes atomically.
commit;
