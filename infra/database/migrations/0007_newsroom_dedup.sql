begin;

alter table public.news_stories
  add column if not exists dedupe_key text,
  add column if not exists content_fingerprint text,
  add column if not exists source_fingerprint text,
  add column if not exists revision bigint not null default 1;

with daily_candidates as (
  select
    id,
    substring(slug from 'daily-cigar-flow-(20[0-9]{2}-[0-9]{2}-[0-9]{2})') as run_date,
    row_number() over (
      partition by substring(slug from 'daily-cigar-flow-(20[0-9]{2}-[0-9]{2}-[0-9]{2})')
      order by published_at desc nulls last, updated_at desc, id desc
    ) as duplicate_rank
  from public.news_stories
  where slug ~ '^daily-cigar-flow-20[0-9]{2}-[0-9]{2}-[0-9]{2}'
)
update public.news_stories as stories
set dedupe_key = 'daily-cigar-flow:' || daily_candidates.run_date
from daily_candidates
where stories.id = daily_candidates.id
  and daily_candidates.duplicate_rank = 1
  and stories.dedupe_key is null;

create unique index if not exists news_stories_dedupe_key_uidx
  on public.news_stories (dedupe_key)
  where dedupe_key is not null;

create index if not exists news_stories_content_fingerprint_idx
  on public.news_stories (content_fingerprint)
  where content_fingerprint is not null;

drop index if exists public.news_stories_source_fingerprint_idx;

with repeated_source_fingerprints as (
  select
    id,
    row_number() over (
      partition by source_fingerprint
      order by published_at desc nulls last, updated_at desc, id desc
    ) as duplicate_rank
  from public.news_stories
  where source_fingerprint is not null
    and status = 'published'
)
update public.news_stories as stories
set source_fingerprint = null
from repeated_source_fingerprints
where stories.id = repeated_source_fingerprints.id
  and repeated_source_fingerprints.duplicate_rank > 1;

create unique index if not exists news_stories_source_fingerprint_uidx
  on public.news_stories (source_fingerprint)
  where source_fingerprint is not null and status = 'published';

create table if not exists public.news_story_processed_leads (
  canonical_url text primary key,
  story_id uuid not null references public.news_stories(id) on delete cascade,
  source_fingerprint text,
  first_processed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint news_story_processed_leads_url_check check (canonical_url ~ '^https://[^[:space:]]+$')
);

create index if not exists news_story_processed_leads_story_idx
  on public.news_story_processed_leads (story_id, first_processed_at desc);

insert into public.schema_migrations (version, name, checksum)
values ('0007', 'newsroom_dedup', 'managed-by-ycc-newsroom-dedup-0007')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
