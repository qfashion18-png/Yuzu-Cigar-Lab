-- Phase 3 commerce backbone for Stripe Checkout, subscriptions, order fulfillment,
-- compliance holds, and auditable operator actions.

begin;

create extension if not exists pgcrypto;

create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received',
  payload jsonb not null
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid,
  email text not null,
  status text not null,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_event_id text,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'usd',
  compliance_status text not null default 'pending',
  fulfillment_status text not null default 'not_started',
  shipping_snapshot jsonb not null default '{}'::jsonb,
  tax_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete cascade,
  sku text not null,
  product_slug text not null,
  product_name text not null,
  stripe_product_id text,
  stripe_price_id text,
  unit_amount_cents integer not null,
  quantity integer not null,
  line_total_cents integer not null
);

create table if not exists public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid,
  email text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  stripe_checkout_session_id text,
  tier_key text not null,
  billing_period text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_compliance_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.commerce_orders(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.commerce_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_sub text,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  request_id text,
  stripe_event_id text,
  order_id uuid references public.commerce_orders(id) on delete set null,
  compliance_hold_id uuid references public.commerce_compliance_holds(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commerce_orders_email_idx on public.commerce_orders(email);
create index if not exists commerce_orders_stripe_checkout_session_id_idx on public.commerce_orders(stripe_checkout_session_id);
create index if not exists member_subscriptions_email_idx on public.member_subscriptions(email);
create index if not exists commerce_compliance_holds_status_idx on public.commerce_compliance_holds(status);
create index if not exists stripe_events_processing_status_idx on public.stripe_events(processing_status);
create index if not exists commerce_audit_log_order_id_idx on public.commerce_audit_log(order_id);

insert into public.schema_migrations (version, name, checksum)
values ('0002', 'commerce_schema', 'managed-by-ycc-commerce-0002')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
