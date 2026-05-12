begin;

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

drop trigger if exists site_page_content_set_updated_at on public.site_page_content;
create trigger site_page_content_set_updated_at
before update on public.site_page_content
for each row execute function public.set_updated_at();

insert into public.schema_migrations (version, name, checksum)
values ('0003', 'site_content_schema', 'managed-by-ycc-site-content-0003')
on conflict (version) do update
set name = excluded.name,
    checksum = excluded.checksum,
    applied_at = now();

commit;
