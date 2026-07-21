-- eGovDX Local — schema
-- Paste into Supabase SQL editor and run. Safe to re-run (drops first).
--
-- RLS is intentionally DISABLED. Every read/write goes through Next.js route
-- handlers using the service role key, so the browser never touches Postgres
-- directly. This is a hackathon-scoped tradeoff; per-LGU RLS policies are the
-- production path and are named as such in the pitch.

drop table if exists request_events   cascade;
drop table if exists requests         cascade;
drop table if exists validation_flags cascade;
drop table if exists studio_generation_cache cascade;
drop table if exists lgu_services     cascade;
drop table if exists service_templates cascade;
drop table if exists officers         cascade;
drop table if exists lgus             cascade;

-- ---------------------------------------------------------------- lgus
-- Self-referencing: a barangay's parent is its city/municipality.
create table lgus (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null check (type in ('city','municipality','barangay')),
  parent_id    uuid references lgus(id) on delete set null,
  region       text,
  psgc_code    text,                    -- PSA standard geographic code
  letterhead_url text,
  seal_url     text,
  created_at   timestamptz not null default now()
);
create index on lgus(parent_id);

-- ------------------------------------------------------------ officers
-- egov_sub is the subject identifier returned by eGovPH SSO. Role is resolved
-- from this table at callback time — SSO authenticates, this table authorizes.
create table officers (
  id         uuid primary key default gen_random_uuid(),
  egov_sub   text unique not null,
  lgu_id     uuid references lgus(id) on delete cascade,
  full_name  text not null,
  position   text,
  role       text not null default 'officer' check (role in ('officer','reviewer')),
  created_at timestamptz not null default now()
);
create index on officers(egov_sub);

-- --------------------------------------------------- service_templates
-- The DICT-approved base. LGUs configure ON TOP of these, never outside them.
-- allowed_rules is the bounded parameter set: what an LGU may legally vary.
create table service_templates (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,   -- e.g. BRGY_CLEARANCE
  name          text not null,
  description   text,
  base_fields   jsonb not null default '[]'::jsonb,
  allowed_rules jsonb not null default '{}'::jsonb,
  max_fee       numeric(10,2),          -- ceiling; LGU fee above this gets flagged
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------- lgu_services
-- One LGU's configured instance of a template.
create table lgu_services (
  id                uuid primary key default gen_random_uuid(),
  lgu_id            uuid not null references lgus(id) on delete cascade,
  template_id       uuid not null references service_templates(id),
  status            text not null default 'draft'
                    check (status in ('draft','flagged','published','rejected')),
  fee_amount        numeric(10,2) not null default 0,
  waivers           jsonb not null default '[]'::jsonb,
  required_docs     jsonb not null default '[]'::jsonb,
  eligibility       jsonb not null default '{}'::jsonb,
  form_fields       jsonb not null default '[]'::jsonb,  -- drives the citizen form renderer
  doc_template_path text,                                -- Supabase Storage path
  source_prompt     text,
  generated_by      text check (generated_by is null or generated_by in ('ai','upload','manual')),
  generator_model   text,
  approval_office   text,
  generation_confidence numeric(4,3),
  reviewed_by       text,
  reviewed_at       timestamptz,
  submitted_at      timestamptz,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (lgu_id, template_id)
);
create index on lgu_services(lgu_id);
create index on lgu_services(status);

-- ---------------------------------------------------- validation_flags
-- Written by the automated validation pass. Unflagged submissions publish fast;
-- flagged ones route to a human. This table IS the "review queue".
create table validation_flags (
  id             uuid primary key default gen_random_uuid(),
  lgu_service_id uuid not null references lgu_services(id) on delete cascade,
  rule_code      text not null,
  severity       text not null default 'warn' check (severity in ('info','warn','block')),
  message        text not null,
  field_path     text,
  resolved       boolean not null default false,
  resolution_note text,
  resolved_by     text,
  resolved_at     timestamptz,
  constraint validation_flag_resolution_audit check (
    not resolved or (length(trim(resolution_note)) > 0 and resolved_by is not null and resolved_at is not null)
  ),
  created_at     timestamptz not null default now()
);
create index on validation_flags(lgu_service_id);

create table studio_generation_cache (
  id          uuid primary key default gen_random_uuid(),
  lgu_id      uuid not null references lgus(id) on delete cascade,
  input_kind  text not null check (input_kind in ('prompt','extraction')),
  input_hash  text not null,
  result      jsonb not null,
  engine      text not null check (engine in ('egov-ai','openai','mock')),
  model       text not null,
  source      text not null check (source in ('live','mock','fallback')),
  primary_error text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (lgu_id, input_kind, input_hash)
);

-- ------------------------------------------------------------ requests
-- A citizen's application. everify_payload holds the verified identity we pulled
-- rather than asked for — that's the whole "don't re-enter your own data" claim.
create table requests (
  id               uuid primary key default gen_random_uuid(),
  lgu_service_id   uuid not null references lgu_services(id) on delete cascade,
  citizen_sub      text,                -- eGovPH SSO subject
  citizen_name     text,
  citizen_mobile   text,
  everify_payload  jsonb,
  liveness_session text,
  liveness_passed  boolean not null default false,
  form_data        jsonb not null default '{}'::jsonb,
  status           text not null default 'submitted'
                   check (status in ('submitted','approved','rejected','issued')),
  fee_due          numeric(10,2) not null default 0,
  fee_status       text not null default 'unpaid'
                   check (fee_status in ('unpaid','waived','paid')),
  waiver_applied   text,
  payment_ref      text,
  control_number   text unique,
  pdf_path         text,
  doc_hash         text unique,         -- sha256 of the issued PDF; the QR resolves this
  chain_tx         text,
  issued_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index on requests(lgu_service_id);
create index on requests(status);
create index on requests(doc_hash);

-- ------------------------------------------------------- request_events
-- Append-only audit trail. Cheap to write, and it's what makes "we did not
-- remove government oversight" a thing you can point at on screen.
create table request_events (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  actor      text not null,             -- 'citizen' | 'officer:<name>' | 'system'
  event      text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on request_events(request_id, created_at);
