-- Draft/published LGU website snapshots and public CMS media metadata.
create table if not exists lgu_site_configs (
  lgu_id uuid primary key references lgus(id) on delete cascade,
  draft_config jsonb not null default '{"branding":{"tagline":"","logoPath":null,"primaryColor":"#0032a0","accentColor":"#fdda25"},"banners":[],"quickLinks":[],"notices":[]}'::jsonb,
  published_config jsonb,
  draft_revision integer not null default 1 check (draft_revision > 0),
  published_revision integer,
  updated_by text,
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  constraint lgu_site_draft_object check (jsonb_typeof(draft_config) = 'object'),
  constraint lgu_site_published_object check (published_config is null or jsonb_typeof(published_config) = 'object')
);

create table if not exists lgu_site_media (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid not null references lgus(id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('logo','banner')),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  original_name text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists lgu_site_media_lgu_idx on lgu_site_media(lgu_id, created_at);
