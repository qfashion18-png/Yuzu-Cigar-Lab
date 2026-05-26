-- Link Yuzu member rows to canonical Stripe Customer ids.

begin;

create extension if not exists pgcrypto;

alter table public.members
  add column if not exists stripe_customer_id text;

with ranked_subscription_customers as (
  select
    m.id as member_id,
    s.stripe_customer_id,
    row_number() over (
      partition by m.id
      order by
        case when lower(s.status) in ('active', 'trialing') then 0 else 1 end,
        coalesce(s.updated_at, s.created_at) desc
    ) as member_rank,
    row_number() over (
      partition by s.stripe_customer_id
      order by
        case when lower(s.status) in ('active', 'trialing') then 0 else 1 end,
        coalesce(s.updated_at, s.created_at) desc,
        m.created_at desc
    ) as customer_rank
  from public.member_subscriptions s
  join public.members m
    on s.member_id = m.id
    or lower(s.email) = lower(m.email)
  where s.stripe_customer_id is not null
    and btrim(s.stripe_customer_id) <> ''
)
update public.members m
set stripe_customer_id = ranked.stripe_customer_id,
    updated_at = now()
from ranked_subscription_customers ranked
where m.id = ranked.member_id
  and m.stripe_customer_id is null
  and ranked.member_rank = 1
  and ranked.customer_rank = 1;

with ranked_order_customers as (
  select
    m.id as member_id,
    o.stripe_customer_id,
    row_number() over (
      partition by m.id
      order by coalesce(o.updated_at, o.created_at) desc
    ) as member_rank,
    row_number() over (
      partition by o.stripe_customer_id
      order by coalesce(o.updated_at, o.created_at) desc, m.created_at desc
    ) as customer_rank
  from public.commerce_orders o
  join public.members m
    on o.member_id = m.id
    or lower(o.email) = lower(m.email)
  where o.stripe_customer_id is not null
    and btrim(o.stripe_customer_id) <> ''
)
update public.members m
set stripe_customer_id = ranked.stripe_customer_id,
    updated_at = now()
from ranked_order_customers ranked
where m.id = ranked.member_id
  and m.stripe_customer_id is null
  and ranked.member_rank = 1
  and ranked.customer_rank = 1;

create unique index if not exists members_stripe_customer_id_uidx
  on public.members (stripe_customer_id)
  where stripe_customer_id is not null;

insert into public.schema_migrations (version, name, checksum)
values ('0005', 'member_stripe_customer_link', 'managed-by-ycc-commerce-0005')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
