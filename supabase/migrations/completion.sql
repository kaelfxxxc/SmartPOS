-- Barcode-aware atomic product creation for Phase 2 completion.
begin;

create or replace function public.create_product_with_barcode(
  p_business_id uuid,
  p_branch_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_price_centavos bigint,
  p_cost_centavos bigint,
  p_opening_quantity numeric,
  p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_product uuid;
  v_barcode text := nullif(trim(p_barcode), '');
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
  if v_barcode is not null and exists (
    select 1 from public.product_barcodes
    where business_id = p_business_id and barcode = v_barcode
  ) then raise exception 'Barcode already belongs to another product'; end if;

  insert into public.products (
    business_id, name, sku, price_centavos, cost_centavos
  ) values (
    p_business_id, trim(p_name), nullif(trim(p_sku), ''),
    p_price_centavos, p_cost_centavos
  ) returning id into v_product;

  if v_barcode is not null then
    insert into public.product_barcodes (
      business_id, product_id, barcode, is_primary
    ) values (p_business_id, v_product, v_barcode, true);
  end if;

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
    v_product, jsonb_build_object('name', trim(p_name), 'sku', p_sku, 'barcode', v_barcode)
  );
  return v_product;
end;
$$;

revoke all on function public.create_product_with_barcode(uuid,uuid,text,text,text,bigint,bigint,numeric,uuid) from public;
grant execute on function public.create_product_with_barcode(uuid,uuid,text,text,text,bigint,bigint,numeric,uuid) to authenticated;

commit;
