-- Citizen application drafts and persisted eGOV chain receipt metadata.

alter table requests drop constraint if exists requests_status_check;
alter table requests add constraint requests_status_check
  check (status in ('draft','submitted','approved','rejected','issued'));

alter table requests alter column status set default 'draft';
alter table requests add column if not exists chain_block_number bigint;
alter table requests add column if not exists chain_anchored_at timestamptz;

create unique index if not exists requests_one_draft_per_citizen_service
  on requests(lgu_service_id, citizen_sub) where status = 'draft';
