begin;

create table if not exists public.news_stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  dek text not null default '',
  category text not null default 'Industry News',
  body_markdown text not null,
  source_notes jsonb not null default '[]'::jsonb,
  official_sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_by_member_id uuid references public.members(id) on delete set null,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id text not null default 'system',
  request_id text not null default 'migration',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_stories_status_check check (status in ('draft', 'published', 'archived')),
  constraint news_stories_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint news_stories_source_notes_array_check check (jsonb_typeof(source_notes) = 'array'),
  constraint news_stories_official_sources_array_check check (jsonb_typeof(official_sources) = 'array')
);

create index if not exists news_stories_published_idx
  on public.news_stories (published_at desc)
  where status = 'published' and published_at is not null;

create index if not exists news_stories_status_updated_idx
  on public.news_stories (status, updated_at desc);

drop trigger if exists news_stories_set_updated_at on public.news_stories;
create trigger news_stories_set_updated_at
before update on public.news_stories
for each row execute function public.set_updated_at();

insert into public.schema_migrations (version, name, checksum)
values ('0004', 'newsroom_schema', 'managed-by-ycc-newsroom-0004')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
