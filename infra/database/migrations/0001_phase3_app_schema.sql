begin;

create extension if not exists pgcrypto;

create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  cognito_sub text not null unique,
  email text not null,
  email_verified boolean not null default false,
  display_name text,
  role text not null default 'customer',
  membership_tier text,
  member_status text not null default 'non_member',
  joined_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_role_check check (role in ('customer', 'admin', 'operator')),
  constraint members_tier_check check (
    membership_tier is null
    or membership_tier in ('box_access_pass', 'kisha', 'sensei', 'daimyo')
  ),
  constraint members_status_check check (
    member_status in ('non_member', 'active', 'paused', 'cancelled', 'banned')
  )
);

create unique index if not exists members_email_lower_uidx on public.members (lower(email));
create index if not exists members_status_idx on public.members (member_status, created_at desc);
create index if not exists members_tier_idx on public.members (membership_tier) where membership_tier is not null;

create table if not exists public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  phone text,
  birthdate date,
  age_verification_status text not null default 'pending',
  tobacco_compliance_ack boolean not null default false,
  default_humidor_location text,
  preferences jsonb not null default '{}'::jsonb,
  shipping_profile jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_profiles_age_status_check check (
    age_verification_status in ('pending', 'verified', 'failed', 'expired')
  )
);

create index if not exists member_profiles_member_id_idx on public.member_profiles (member_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  agent_name text not null default 'YCCConcierge',
  channel text not null default 'web',
  status text not null default 'open',
  title text,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_agent_check check (
    agent_name in ('YCCConcierge', 'YCCCigarGuide', 'YCCSupportAgent', 'YCCHumidorAgent', 'YCCAdminAgent', 'YCCNewsAgent')
  ),
  constraint conversations_channel_check check (channel in ('web', 'email', 'admin', 'system')),
  constraint conversations_status_check check (status in ('open', 'waiting', 'resolved', 'archived'))
);

create index if not exists conversations_member_id_idx on public.conversations (member_id, created_at desc);
create index if not exists conversations_status_idx on public.conversations (status, updated_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  role text not null,
  content text not null,
  model text,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  constraint conversation_messages_role_check check (
    role in ('user', 'assistant', 'system', 'tool', 'operator')
  ),
  constraint conversation_messages_token_count_check check (
    token_count is null or token_count >= 0
  )
);

create index if not exists conversation_messages_conversation_idx
  on public.conversation_messages (conversation_id, created_at);
create index if not exists conversation_messages_member_id_idx
  on public.conversation_messages (member_id, created_at desc);

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null default ('YCC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  member_id uuid references public.members(id) on delete set null,
  subject text not null,
  status text not null default 'new',
  priority text not null default 'normal',
  source text not null default 'web',
  assigned_group text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  last_activity_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_cases_status_check check (
    status in ('new', 'open', 'waiting_on_member', 'waiting_on_ycc', 'resolved', 'closed')
  ),
  constraint support_cases_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint support_cases_source_check check (source in ('web', 'email', 'admin', 'system'))
);

create unique index if not exists support_cases_case_number_uidx on public.support_cases (case_number);
create index if not exists support_cases_member_id_idx on public.support_cases (member_id, created_at desc);
create index if not exists support_cases_open_idx
  on public.support_cases (priority, created_at)
  where status in ('new', 'open', 'waiting_on_ycc');

create table if not exists public.support_email_messages (
  id uuid primary key default gen_random_uuid(),
  support_case_id uuid not null references public.support_cases(id) on delete cascade,
  direction text not null,
  from_address text not null,
  to_addresses text[] not null default '{}'::text[],
  cc_addresses text[] not null default '{}'::text[],
  subject text,
  body_text text,
  body_html text,
  ses_message_id text,
  s3_raw_key text,
  draft_status text not null default 'draft',
  sent_at timestamptz,
  received_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_email_direction_check check (direction in ('inbound', 'outbound')),
  constraint support_email_draft_status_check check (
    draft_status in ('draft', 'queued', 'sent', 'failed', 'received')
  )
);

create index if not exists support_email_case_idx
  on public.support_email_messages (support_case_id, created_at);
create index if not exists support_email_ses_message_idx
  on public.support_email_messages (ses_message_id)
  where ses_message_id is not null;
create index if not exists support_email_s3_raw_key_idx
  on public.support_email_messages (s3_raw_key)
  where s3_raw_key is not null;

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  full_name text,
  phone text,
  consent boolean not null default true,
  consented_at timestamptz not null default now(),
  source text not null default 'website',
  page_path text,
  wants_monthly_membership boolean not null default false,
  preferred_tier text,
  status text not null default 'subscribed',
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_subscribers_tier_check check (
    preferred_tier is null
    or preferred_tier in ('box_access_pass', 'kisha', 'sensei', 'daimyo')
  ),
  constraint newsletter_subscribers_status_check check (
    status in ('subscribed', 'unsubscribed', 'bounced', 'suppressed')
  )
);

create unique index if not exists newsletter_subscribers_email_lower_uidx
  on public.newsletter_subscribers (lower(email));
create index if not exists newsletter_subscribers_membership_interest_idx
  on public.newsletter_subscribers (wants_monthly_membership, created_at desc)
  where wants_monthly_membership = true;
create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status, created_at desc);

create table if not exists public.humidor_items (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  product_id text,
  name text not null,
  brand text,
  line text,
  vitola text,
  wrapper text,
  origin text,
  strength text,
  quantity integer not null default 1,
  purchase_date date,
  aging_start_date date,
  tasting_notes text,
  rating integer,
  humidor_location text,
  tray text,
  reorder_reminder date,
  source text not null default 'api',
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint humidor_items_quantity_check check (quantity >= 0),
  constraint humidor_items_rating_check check (rating is null or rating between 0 and 100)
);

create index if not exists humidor_items_member_active_idx
  on public.humidor_items (member_id, created_at desc)
  where archived_at is null;
create index if not exists humidor_items_member_brand_idx on public.humidor_items (member_id, brand);
create index if not exists humidor_items_reorder_idx
  on public.humidor_items (reorder_reminder)
  where reorder_reminder is not null and archived_at is null;

create table if not exists public.smoke_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  humidor_item_id uuid references public.humidor_items(id) on delete set null,
  cigar_name text not null,
  smoked_at timestamptz not null default now(),
  rating integer,
  pairing text,
  notes text,
  duration_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smoke_logs_rating_check check (rating is null or rating between 0 and 100),
  constraint smoke_logs_duration_check check (duration_minutes is null or duration_minutes > 0)
);

create index if not exists smoke_logs_member_smoked_at_idx on public.smoke_logs (member_id, smoked_at desc);
create index if not exists smoke_logs_humidor_item_id_idx on public.smoke_logs (humidor_item_id, smoked_at desc);

create table if not exists public.site_page_content (
  route text primary key,
  edits jsonb not null default '{}'::jsonb,
  updated_by_member_id uuid references public.members(id) on delete set null,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_page_content_route_check check (
    route in ('/', '/membership', '/education')
  )
);

create index if not exists site_page_content_published_idx
  on public.site_page_content (published_at desc)
  where published_at is not null;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null default 'system',
  request_id text not null,
  member_id uuid references public.members(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_member_id_idx on public.audit_log (member_id, created_at desc);
create index if not exists audit_log_resource_idx on public.audit_log (resource_type, resource_id, created_at desc);
create index if not exists audit_log_request_id_idx on public.audit_log (request_id);

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  provider_name text not null,
  provider_type text not null,
  status text not null default 'pending',
  external_account_id text,
  scopes text[] not null default '{}'::text[],
  credential_secret_arn text,
  last_connected_at timestamptz,
  last_tested_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_connections_type_check check (
    provider_type in ('commerce', 'email', 'social', 'age_verification', 'tax', 'shipping', 'ai')
  ),
  constraint provider_connections_status_check check (
    status in ('pending', 'connected', 'error', 'disabled')
  )
);

create index if not exists provider_connections_member_id_idx
  on public.provider_connections (member_id, provider_type);
create unique index if not exists provider_connections_external_uidx
  on public.provider_connections (provider_name, external_account_id)
  where external_account_id is not null;
create index if not exists provider_connections_status_idx on public.provider_connections (status, provider_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists member_profiles_set_updated_at on public.member_profiles;
create trigger member_profiles_set_updated_at
before update on public.member_profiles
for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists support_cases_set_updated_at on public.support_cases;
create trigger support_cases_set_updated_at
before update on public.support_cases
for each row execute function public.set_updated_at();

drop trigger if exists support_email_messages_set_updated_at on public.support_email_messages;
create trigger support_email_messages_set_updated_at
before update on public.support_email_messages
for each row execute function public.set_updated_at();

drop trigger if exists newsletter_subscribers_set_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_set_updated_at
before update on public.newsletter_subscribers
for each row execute function public.set_updated_at();

drop trigger if exists humidor_items_set_updated_at on public.humidor_items;
create trigger humidor_items_set_updated_at
before update on public.humidor_items
for each row execute function public.set_updated_at();

drop trigger if exists smoke_logs_set_updated_at on public.smoke_logs;
create trigger smoke_logs_set_updated_at
before update on public.smoke_logs
for each row execute function public.set_updated_at();

drop trigger if exists site_page_content_set_updated_at on public.site_page_content;
create trigger site_page_content_set_updated_at
before update on public.site_page_content
for each row execute function public.set_updated_at();

drop trigger if exists provider_connections_set_updated_at on public.provider_connections;
create trigger provider_connections_set_updated_at
before update on public.provider_connections
for each row execute function public.set_updated_at();

alter table public.conversations drop constraint if exists conversations_agent_check;
alter table public.conversations
  add constraint conversations_agent_check check (
    agent_name in ('YCCConcierge', 'YCCCigarGuide', 'YCCSupportAgent', 'YCCHumidorAgent', 'YCCAdminAgent', 'YCCNewsAgent')
  );

insert into public.schema_migrations (version, name, checksum)
values ('0001', 'phase3_app_schema', 'managed-by-ycc-phase3-0001')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
