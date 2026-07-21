-- 002 — columns the AI eService Studio and the payment/issuance flow need.
--
-- Additive only: new nullable columns and one new table. Nothing is renamed or
-- dropped, so it is safe to run while other people's harnesses are reading these
-- tables. Run it in the Supabase SQL editor after 001 (supabase/schema.sql).
--
-- Safe to re-run.

-- ------------------------------------------------------------ lgus
-- Act 1 registers an LGU live, so we need to record who did it and when.
alter table lgus add column if not exists official_email text;
alter table lgus add column if not exists registered_by  text;
alter table lgus add column if not exists registered_at  timestamptz;
alter table lgus add column if not exists logo_url       text;

-- ---------------------------------------------------- lgu_services
-- source_prompt is the citizen-visible provenance of an AI-generated service:
-- it lets a reviewer read the natural-language request the officer actually
-- typed, next to the schema it produced. That pairing is what makes the review
-- queue meaningful rather than a rubber stamp.
alter table lgu_services add column if not exists source_prompt   text;
alter table lgu_services add column if not exists generated_by    text
  check (generated_by is null or generated_by in ('ai','upload','manual'));
alter table lgu_services add column if not exists generator_model text;
-- Which office signs off, e.g. 'Municipal Health Office'.
alter table lgu_services add column if not exists approval_office text;

-- --------------------------------------------------------- requests
-- eGovPay returns a transaction uuid plus a hosted checkout url; both are
-- needed to resume or reconcile a payment the citizen abandoned.
alter table requests add column if not exists payment_uuid  text;
alter table requests add column if not exists payment_url   text;
alter table requests add column if not exists payment_txnid text;
-- Supporting documents the citizen uploaded, as Supabase Storage paths.
alter table requests add column if not exists uploaded_docs jsonb not null default '[]'::jsonb;
-- Liveness confidence is kept for audit: we accept only >= 95.0, and a
-- rejected-for-low-score attempt is exactly the thing you want a record of.
alter table requests add column if not exists liveness_score numeric(5,2);
alter table requests add column if not exists everify_reference text;

create index if not exists requests_payment_uuid_idx on requests(payment_uuid);

-- --------------------------------------------------- psgc_reference
-- Minimal PSA geographic reference so "Register LGU" is a real lookup against
-- actual Philippine LGUs rather than a hardcoded dropdown of two options.
-- Populated by supabase/seed_psgc.sql.
create table if not exists psgc_reference (
  code            text primary key,
  name            text not null,
  level           text not null check (level in ('region','province','municipality','city','barangay')),
  parent_code     text,
  region_code     text,
  province_code   text
);

create index if not exists psgc_reference_parent_idx on psgc_reference(parent_code);
create index if not exists psgc_reference_level_idx  on psgc_reference(level);
