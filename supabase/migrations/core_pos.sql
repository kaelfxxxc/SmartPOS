-- SmartPOS Phase 2: atomic product setup, stock receiving, and cash checkout.
begin;

do $$ begin
  create type public.sale_status as enum ('completed', 'voided', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'gcash', 'maya', 'credit');
exception when duplicate_object then null;
end $$;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  cashier_user_id uuid not null references public.profiles(id),
  receipt_number text not null,
  status public.sale_status not null default 'completed',
  subtotal_centavos bigint not null check (subtotal_centavos >= 0),
  discount_centavos bigint not null default 0 check (discount_centavos >= 0),
  tax_centavos bigint not null default 0 check (tax_centavos >= 0),
  total_centavos bigint not null check (total_centavos >= 0),
  item_count numeric(14,3) not null check (item_count > 0),
  idempotency_key uuid not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, receipt_number),
  unique (business_id, idempotency_key)
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id),
  product_name text not null,
  sku text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  unit_cost_centavos bigint not null check (unit_cost_centavos >= 0),
  tax_class text not null,
  line_total_centavos bigint not null check (line_total_centavos >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  sale_id uuid not null references public.sales(id),
  method public.payment_method not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  tendered_centavos bigint,
  change_centavos bigint not null default 0 check (change_centavos >= 0),
  reference text,
  verification_status text not null default 'confirmed'
    check (verification_status in ('confirmed', 'cashier_confirmed', 'unverified', 'provider_verified')),
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_sequences (
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  next_number bigint not null default 1 check (next_number > 0),
  primary key (business_id, branch_id)
);

create index if not exists sales_branch_time_idx on public.sales(branch_id, completed_at desc);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists payments_sale_idx on public.payments(sale_id);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.receipt_sequences enable row level security;

drop policy if exists sales_branch_select on public.sales;
create policy sales_branch_select on public.sales for select
  using (public.can_access_branch(business_id, branch_id));
drop policy if exists sale_items_member_select on public.sale_items;
create policy sale_items_member_select on public.sale_items for select
  using (public.is_business_member(business_id));
drop policy if exists payments_branch_select on public.payments;
create policy payments_branch_select on public.payments for select
  using (public.can_access_branch(business_id, branch_id));

create or replace function public.create_product_with_stock(
  p_business_id uuid,
  p_branch_id uuid,
  p_name text,
  p_sku text,
  p_price_centavos bigint,
  p_cost_centavos bigint,
  p_opening_quantity numeric,
  p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_product uuid;
begin
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','inventory_staff']::public.member_role[]
  ) or not public.can_access_branch(p_business_id, p_branch_id) then
    raise exception 'Not authorized';
  end if;
  if length(trim(p_name)) < 1 or p_price_centavos < 0 or
     p_cost_centavos < 0 or p_opening_quantity < 0 then
    raise exception 'Invalid product details';
  end if;

  insert into public.products (
    business_id, name, sku, price_centavos, cost_centavos
  ) values (
    p_business_id, trim(p_name), nullif(trim(p_sku), ''),
    p_price_centavos, p_cost_centavos
  ) returning id into v_product;

  insert into public.inventory_balances (
    business_id, branch_id, product_id, confirmed_quantity, version
  ) values (
    p_business_id, p_branch_id, v_product, p_opening_quantity, 1
  );

  if p_opening_quantity > 0 then
    insert into public.inventory_movements (
      business_id, branch_id, product_id, movement_type, quantity_change,
      reason, staff_user_id, idempotency_key
    ) values (
      p_business_id, p_branch_id, v_product, 'initial_stock',
      p_opening_quantity, 'Opening stock', auth.uid(), p_idempotency_key
    );
  end if;

  insert into public.audit_logs (
    business_id, branch_id, actor_user_id, action, entity_type, entity_id, new_values
  ) values (
    p_business_id, p_branch_id, auth.uid(), 'product.created', 'product',
    v_product, jsonb_build_object('name', trim(p_name), 'sku', p_sku)
  );
  return v_product;
end;
$$;

create or replace function public.receive_stock(
  p_business_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key uuid
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_quantity numeric;
begin
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','inventory_staff']::public.member_role[]
  ) or not public.can_access_branch(p_business_id, p_branch_id) then
    raise exception 'Not authorized';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if not exists (
    select 1 from public.products where id = p_product_id
      and business_id = p_business_id and status = 'active'
  ) then raise exception 'Product not found'; end if;

  insert into public.inventory_balances (
    business_id, branch_id, product_id, confirmed_quantity, version
  ) values (
    p_business_id, p_branch_id, p_product_id, p_quantity, 1
  )
  on conflict (branch_id, product_id) do update
    set confirmed_quantity = public.inventory_balances.confirmed_quantity + excluded.confirmed_quantity,
        version = public.inventory_balances.version + 1,
        updated_at = now()
  returning confirmed_quantity into v_quantity;

  insert into public.inventory_movements (
    business_id, branch_id, product_id, movement_type, quantity_change,
    reason, staff_user_id, idempotency_key
  ) values (
    p_business_id, p_branch_id, p_product_id, 'purchase', p_quantity,
    coalesce(nullif(trim(p_reason), ''), 'Stock received'),
    auth.uid(), p_idempotency_key
  );
  return v_quantity;
end;
$$;

create or replace function public.complete_cash_sale(
  p_business_id uuid,
  p_branch_id uuid,
  p_items jsonb,
  p_tendered_centavos bigint,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid;
  v_receipt_number text;
  v_sequence bigint;
  v_total bigint := 0;
  v_item_count numeric := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric;
  v_line_total bigint;
begin
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','cashier']::public.member_role[]
  ) or not public.can_access_branch(p_business_id, p_branch_id) then
    raise exception 'Not authorized';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Basket is empty';
  end if;

  insert into public.receipt_sequences (business_id, branch_id, next_number)
  values (p_business_id, p_branch_id, 2)
  on conflict (business_id, branch_id) do update
    set next_number = public.receipt_sequences.next_number + 1
  returning next_number - 1 into v_sequence;
  v_receipt_number := 'SALE-' || lpad(v_sequence::text, 6, '0');

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity <= 0 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and business_id = p_business_id and status = 'active';
    if not found then raise exception 'Product unavailable'; end if;
    perform 1 from public.inventory_balances
      where branch_id = p_branch_id and product_id = v_product.id
        and confirmed_quantity >= v_quantity for update;
    if not found then raise exception 'Insufficient stock for %', v_product.name; end if;
    v_line_total := v_product.price_centavos * v_quantity;
    v_total := v_total + v_line_total;
    v_item_count := v_item_count + v_quantity;
  end loop;

  if p_tendered_centavos < v_total then raise exception 'Insufficient cash tendered'; end if;

  insert into public.sales (
    business_id, branch_id, cashier_user_id, receipt_number,
    subtotal_centavos, total_centavos, item_count, idempotency_key
  ) values (
    p_business_id, p_branch_id, auth.uid(), v_receipt_number,
    v_total, v_total, v_item_count, p_idempotency_key
  ) returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and business_id = p_business_id;
    v_line_total := v_product.price_centavos * v_quantity;
    insert into public.sale_items (
      business_id, sale_id, product_id, product_name, sku, quantity,
      unit_price_centavos, unit_cost_centavos, tax_class, line_total_centavos
    ) values (
      p_business_id, v_sale, v_product.id, v_product.name, v_product.sku,
      v_quantity, v_product.price_centavos, v_product.cost_centavos,
      v_product.tax_class, v_line_total
    );
    update public.inventory_balances
      set confirmed_quantity = confirmed_quantity - v_quantity,
          version = version + 1, updated_at = now()
      where branch_id = p_branch_id and product_id = v_product.id;
    insert into public.inventory_movements (
      business_id, branch_id, product_id, movement_type, quantity_change,
      reason, reference_type, reference_id, staff_user_id, idempotency_key
    ) values (
      p_business_id, p_branch_id, v_product.id, 'sale', -v_quantity,
      'Completed sale', 'sale', v_sale, auth.uid(), gen_random_uuid()
    );
  end loop;

  insert into public.payments (
    business_id, branch_id, sale_id, method, amount_centavos,
    tendered_centavos, change_centavos
  ) values (
    p_business_id, p_branch_id, v_sale, 'cash', v_total,
    p_tendered_centavos, p_tendered_centavos - v_total
  );
  insert into public.audit_logs (
    business_id, branch_id, actor_user_id, action, entity_type, entity_id, new_values
  ) values (
    p_business_id, p_branch_id, auth.uid(), 'sale.completed', 'sale', v_sale,
    jsonb_build_object('receipt_number', v_receipt_number, 'total_centavos', v_total)
  );
  return jsonb_build_object(
    'sale_id', v_sale, 'receipt_number', v_receipt_number,
    'total_centavos', v_total, 'change_centavos', p_tendered_centavos - v_total
  );
end;
$$;

revoke all on function public.create_product_with_stock(uuid,uuid,text,text,bigint,bigint,numeric,uuid) from public;
revoke all on function public.receive_stock(uuid,uuid,uuid,numeric,text,uuid) from public;
revoke all on function public.complete_cash_sale(uuid,uuid,jsonb,bigint,uuid) from public;
grant execute on function public.create_product_with_stock(uuid,uuid,text,text,bigint,bigint,numeric,uuid) to authenticated;
grant execute on function public.receive_stock(uuid,uuid,uuid,numeric,text,uuid) to authenticated;
grant execute on function public.complete_cash_sale(uuid,uuid,jsonb,bigint,uuid) to authenticated;

commit;
