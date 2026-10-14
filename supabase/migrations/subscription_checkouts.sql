begin;

create table public.subscription_checkouts (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  paymongo_session_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('starter', 'professional')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  amount_centavos integer not null check (amount_centavos > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.subscription_checkouts enable row level security;

create policy subscription_checkouts_owner_read
  on public.subscription_checkouts for select
  using (
    public.has_business_role(
      business_id,
      array['owner','admin']::public.member_role[]
    )
  );

commit;
