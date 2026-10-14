-- SmartPOS customer directory and credit-account foundation.
begin;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  name text not null check (length(trim(name)) >= 2),
  phone text,
  address text,
  credit_limit_centavos bigint not null default 0 check (credit_limit_centavos >= 0),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  customer_id uuid not null references public.customers(id),
  outstanding_centavos bigint not null default 0 check (outstanding_centavos >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

create table public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid references public.branches(id),
  account_id uuid not null references public.customer_credit_accounts(id),
  entry_type text not null check (entry_type in ('credit_sale', 'repayment', 'adjustment')),
  amount_centavos bigint not null check (amount_centavos <> 0),
  reference_type text,
  reference_id uuid,
  notes text,
  staff_user_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index customers_business_name_idx on public.customers(business_id, name);
create index credit_accounts_business_idx on public.customer_credit_accounts(business_id, outstanding_centavos desc);
create index credit_ledger_account_time_idx on public.credit_ledger_entries(account_id, created_at desc);

create trigger customers_updated before update on public.customers
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_credit_accounts enable row level security;
alter table public.credit_ledger_entries enable row level security;

create policy customers_member_select on public.customers for select
  using (public.is_business_member(business_id));
create policy customers_manager_update on public.customers for update
  using (public.has_business_role(
    business_id,
    array['owner','admin','manager']::public.member_role[]
  ));
create policy credit_accounts_member_select on public.customer_credit_accounts for select
  using (public.is_business_member(business_id));
create policy credit_ledger_member_select on public.credit_ledger_entries for select
  using (public.is_business_member(business_id));

create or replace function public.create_customer(
  p_business_id uuid,
  p_name text,
  p_phone text,
  p_address text,
  p_credit_limit_centavos bigint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid;
begin
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','cashier']::public.member_role[]
  ) then raise exception 'Not authorized'; end if;
  if length(trim(p_name)) < 2 or p_credit_limit_centavos < 0 then
    raise exception 'Invalid customer details';
  end if;
  insert into public.customers (
    business_id, name, phone, address, credit_limit_centavos
  ) values (
    p_business_id, trim(p_name), nullif(trim(p_phone), ''),
    nullif(trim(p_address), ''), p_credit_limit_centavos
  ) returning id into v_customer;
  insert into public.customer_credit_accounts (business_id, customer_id)
  values (p_business_id, v_customer);
  insert into public.audit_logs (
    business_id, actor_user_id, action, entity_type, entity_id, new_values
  ) values (
    p_business_id, auth.uid(), 'customer.created', 'customer', v_customer,
    jsonb_build_object('name', trim(p_name), 'credit_limit_centavos', p_credit_limit_centavos)
  );
  return v_customer;
end;
$$;

create or replace function public.record_credit_repayment(
  p_business_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_amount_centavos bigint,
  p_notes text,
  p_idempotency_key uuid
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_outstanding bigint;
begin
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','cashier']::public.member_role[]
  ) or not public.can_access_branch(p_business_id, p_branch_id) then
    raise exception 'Not authorized';
  end if;
  if p_amount_centavos <= 0 then raise exception 'Repayment must be positive'; end if;
  select id, outstanding_centavos into v_account, v_outstanding
    from public.customer_credit_accounts
    where business_id = p_business_id and customer_id = p_customer_id
    for update;
  if not found then raise exception 'Credit account not found'; end if;
  if p_amount_centavos > v_outstanding then raise exception 'Repayment exceeds outstanding balance'; end if;
  update public.customer_credit_accounts
    set outstanding_centavos = outstanding_centavos - p_amount_centavos,
        version = version + 1, updated_at = now()
    where id = v_account
    returning outstanding_centavos into v_outstanding;
  insert into public.credit_ledger_entries (
    business_id, branch_id, account_id, entry_type, amount_centavos,
    notes, staff_user_id, idempotency_key
  ) values (
    p_business_id, p_branch_id, v_account, 'repayment', -p_amount_centavos,
    nullif(trim(p_notes), ''), auth.uid(), p_idempotency_key
  );
  return v_outstanding;
end;
$$;

revoke all on function public.create_customer(uuid,text,text,text,bigint) from public;
revoke all on function public.record_credit_repayment(uuid,uuid,uuid,bigint,text,uuid) from public;
grant execute on function public.create_customer(uuid,text,text,text,bigint) to authenticated;
grant execute on function public.record_credit_repayment(uuid,uuid,uuid,bigint,text,uuid) to authenticated;

commit;
