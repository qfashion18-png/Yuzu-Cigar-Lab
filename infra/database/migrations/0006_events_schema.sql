begin;

create table if not exists public.event_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_source_id text not null,
  name text not null default '',
  source_type text not null default 'calendar',
  enabled boolean not null default true,
  trusted boolean not null default false,
  auto_publish boolean not null default false,
  credential_secret_id text,
  sync_token text,
  webhook_channel jsonb not null default '{}'::jsonb,
  webhook_expires_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  stale_after interval not null default interval '1 hour',
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_sources_provider_check check (provider in ('google_calendar', 'eventbrite', 'ics', 'rss', 'facebook', 'manual')),
  constraint event_sources_type_check check (source_type in ('calendar', 'ticketing', 'feed', 'operator_import', 'manual')),
  constraint event_sources_provider_external_unique unique (provider, external_source_id),
  constraint event_sources_webhook_channel_object_check check (jsonb_typeof(webhook_channel) = 'object'),
  constraint event_sources_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  source_id uuid references public.event_sources(id) on delete set null,
  source_type text not null default 'manual',
  provider text not null default 'manual',
  external_id text,
  external_occurrence_id text,
  provider_event_id text,
  provider_occurrence_id text,
  idempotency_key text,
  recurrence_rule text,
  recurrence_parent_external_id text,
  title text not null,
  summary text not null default '',
  description text not null default '',
  host text not null default '',
  status text not null default 'draft',
  visibility text not null default 'public',
  verification_status text not null default 'needs_review',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  start_date date,
  end_date date,
  timezone text not null default 'America/Phoenix',
  all_day boolean not null default false,
  venue_name text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  country text not null default 'US',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  source_url text,
  ticket_url text,
  image_url text,
  access_level text not null default 'public',
  capacity integer,
  includes jsonb not null default '[]'::jsonb,
  agenda jsonb not null default '[]'::jsonb,
  good_for jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  last_seen_at timestamptz,
  published_at timestamptz,
  canceled_at timestamptz,
  archived_at timestamptz,
  created_by_member_id uuid references public.members(id) on delete set null,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_source_type_check check (source_type in ('google_calendar', 'eventbrite', 'ics', 'rss', 'operator_import', 'manual')),
  constraint events_provider_check check (provider in ('google_calendar', 'eventbrite', 'ics', 'rss', 'facebook', 'manual')),
  constraint events_status_check check (status in ('draft', 'published', 'canceled', 'archived')),
  constraint events_visibility_check check (visibility in ('public', 'members', 'sensei', 'daimyo')),
  constraint events_verification_check check (verification_status in ('trusted_source', 'needs_review', 'verified', 'stale')),
  constraint events_access_level_check check (access_level in ('public', 'members', 'sensei', 'daimyo')),
  constraint events_time_check check (ends_at > starts_at),
  constraint events_capacity_check check (capacity is null or capacity >= 0),
  constraint events_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint events_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint events_includes_array_check check (jsonb_typeof(includes) = 'array'),
  constraint events_agenda_array_check check (jsonb_typeof(agenda) = 'array'),
  constraint events_good_for_array_check check (jsonb_typeof(good_for) = 'array'),
  constraint events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists events_provider_occurrence_uidx
  on public.events (
    source_id,
    coalesce(provider_event_id, external_id, ''),
    coalesce(provider_occurrence_id, external_occurrence_id, '')
  )
  where source_id is not null;

create unique index if not exists events_idempotency_key_uidx
  on public.events (idempotency_key)
  where idempotency_key is not null;

create index if not exists events_public_window_idx
  on public.events (starts_at, ends_at, updated_at desc)
  where status = 'published' and visibility = 'public' and canceled_at is null and archived_at is null;

create index if not exists events_admin_status_updated_idx
  on public.events (status, updated_at desc);

create index if not exists events_source_last_seen_idx
  on public.events (source_id, last_seen_at desc)
  where source_id is not null;

create table if not exists public.event_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.event_sources(id) on delete cascade,
  provider text not null,
  mode text not null,
  status text not null default 'started',
  idempotency_key text,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  canceled_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  next_sync_token text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  request_id text not null default 'scheduled-sync',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint event_sync_runs_provider_check check (provider in ('google_calendar', 'eventbrite', 'ics', 'rss', 'facebook', 'manual')),
  constraint event_sync_runs_mode_check check (mode in ('full', 'incremental', 'webhook', 'manual')),
  constraint event_sync_runs_status_check check (status in ('started', 'succeeded', 'partial', 'failed')),
  constraint event_sync_runs_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists event_sync_runs_idempotency_uidx
  on public.event_sync_runs (idempotency_key)
  where idempotency_key is not null;

create index if not exists event_sync_runs_source_started_idx
  on public.event_sync_runs (source_id, started_at desc);

drop trigger if exists event_sources_set_updated_at on public.event_sources;
create trigger event_sources_set_updated_at
before update on public.event_sources
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

insert into public.schema_migrations (version, name, checksum)
values ('0006', 'events_schema', 'managed-by-ycc-events-0006')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
