-- GCash and Maya branch wallet ledger.
begin;

create table public.digital_wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  wallet_provider text not null check (wallet_provider in ('gcash', 'maya')),
  transaction_type text not null check (transaction_type in ('cash_in', 'cash_out')),
  amount_centavos bigint not null check (amount_centavos > 0),
  reference text,
  notes text,
  staff_user_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index digital_wallet_branch_time_idx
  on public.digital_wallet_ledger_entries(branch_id, created_at desc);

alter table public.digital_wallet_ledger_entries enable row level security;

create policy digital_wallet_member_select
  on public.digital_wallet_ledger_entries for select
  using (public.can_access_branch(business_id, branch_id));

create or replace function public.record_digital_wallet_transaction(
  p_business_id uuid,
  p_branch_id uuid,
  p_wallet_provider text,
  p_transaction_type text,
  p_amount_centavos bigint,
  p_reference text,
  p_notes text,
  p_idempotency_key uuid
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
begin
  if not public.has_business_role(
    p_business_id,
    array['owner','admin','manager','cashier']::public.member_role[]
  ) or not public.can_access_branch(p_business_id, p_branch_id) then
    raise exception 'Not authorized';
  end if;

  if p_wallet_provider not in ('gcash', 'maya') then
    raise exception 'Invalid wallet provider';
  end if;
  if p_transaction_type not in ('cash_in', 'cash_out') then
    raise exception 'Invalid transaction type';
  end if;
  if p_amount_centavos <= 0 then
    raise exception 'Amount must be positive';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || p_branch_id::text || p_wallet_provider, 0)
  );

  select coalesce(sum(
    case when transaction_type = 'cash_in' then amount_centavos else -amount_centavos end
  ), 0)
  into v_balance
  from public.digital_wallet_ledger_entries
  where business_id = p_business_id
    and branch_id = p_branch_id
    and wallet_provider = p_wallet_provider;

  if p_transaction_type = 'cash_out' and p_amount_centavos > v_balance then
    raise exception 'Cash out exceeds the current wallet balance';
  end if;

  insert into public.digital_wallet_ledger_entries (
    business_id, branch_id, wallet_provider, transaction_type,
    amount_centavos, reference, notes, staff_user_id, idempotency_key
  ) values (
    p_business_id, p_branch_id, p_wallet_provider, p_transaction_type,
    p_amount_centavos, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''),
    auth.uid(), p_idempotency_key
  );

  if p_transaction_type = 'cash_in' then
    v_balance := v_balance + p_amount_centavos;
  else
    v_balance := v_balance - p_amount_centavos;
  end if;

  insert into public.audit_logs (
    business_id, branch_id, actor_user_id, action, entity_type, new_values
  ) values (
    p_business_id, p_branch_id, auth.uid(),
    'digital_wallet.' || p_transaction_type,
    'digital_wallet_ledger_entry',
    jsonb_build_object(
      'wallet_provider', p_wallet_provider,
      'amount_centavos', p_amount_centavos,
      'balance_centavos', v_balance
    )
  );

  return v_balance;
end;
$$;

revoke all on function public.record_digital_wallet_transaction(uuid,uuid,text,text,bigint,text,text,uuid) from public;
grant execute on function public.record_digital_wallet_transaction(uuid,uuid,text,text,bigint,text,text,uuid) to authenticated;

commit;
