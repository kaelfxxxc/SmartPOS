-- Per-business trial and subscription status.
begin;

create table public.business_subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan text not null default 'free_trial'
    check (plan in ('free_trial', 'starter', 'professional')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'expired', 'canceled')),
  billing_cycle text
    check (billing_cycle is null or billing_cycle in ('monthly', 'annual')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  current_period_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  check (trial_ends_at > trial_started_at)
);

insert into public.business_subscriptions (
  business_id, trial_started_at, trial_ends_at
)
select id, created_at, created_at + interval '7 days'
from public.businesses
on conflict (business_id) do nothing;

create or replace function public.create_business_subscription()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_subscriptions (
    business_id, trial_started_at, trial_ends_at
  ) values (
    new.id, new.created_at, new.created_at + interval '7 days'
  ) on conflict (business_id) do nothing;
  return new;
end;
$$;

create trigger businesses_create_subscription
after insert on public.businesses
for each row execute function public.create_business_subscription();

alter table public.business_subscriptions enable row level security;

create policy business_subscriptions_member_select
  on public.business_subscriptions for select
  using (public.is_business_member(business_id));

create policy business_subscriptions_owner_update
  on public.business_subscriptions for update
  using (public.has_business_role(
    business_id,
    array['owner','admin']::public.member_role[]
  ));

commit;
