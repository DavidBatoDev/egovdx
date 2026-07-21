-- 004 — Elton's payment, approval, issuance, notification, and analytics state.
-- Additive and safe to re-run after migrations 001–003.

alter table officers add column if not exists office text;

alter table requests add column if not exists approved_by text;
alter table requests add column if not exists approved_at timestamptz;
alter table requests add column if not exists rejected_by text;
alter table requests add column if not exists rejected_at timestamptz;
alter table requests add column if not exists rejection_note text;
alter table requests add column if not exists issuance_status text not null default 'not_started';
alter table requests add column if not exists issuance_attempts integer not null default 0;
alter table requests add column if not exists issuance_started_at timestamptz;
alter table requests add column if not exists issuance_error text;
alter table requests add column if not exists chain_source text;
alter table requests add column if not exists sms_status text not null default 'not_sent';
alter table requests add column if not exists sms_source text;
alter table requests add column if not exists sms_message_id text;
alter table requests add column if not exists sms_sent_at timestamptz;
alter table requests add column if not exists sms_error text;
alter table requests add column if not exists payment_source text;
alter table requests add column if not exists payment_checked_at timestamptz;

do $$ begin
  alter table requests add constraint requests_issuance_status_check
    check (issuance_status in ('not_started','processing','failed','issued'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table requests add constraint requests_sms_status_check
    check (sms_status in ('not_sent','sending','sent','failed','unknown'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table requests add constraint requests_chain_source_check
    check (chain_source is null or chain_source in ('live','mock','fallback'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table requests add constraint requests_sms_source_check
    check (sms_source is null or sms_source in ('live','mock','fallback'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table requests add constraint requests_payment_source_check
    check (payment_source is null or payment_source in ('live','mock','fallback'));
exception when duplicate_object then null; end $$;

create table if not exists lgu_control_sequences (
  lgu_id uuid not null references lgus(id) on delete cascade,
  year integer not null,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (lgu_id, year)
);

create or replace function claim_request_approval(
  p_request_id uuid,
  p_officer_sub text
)
returns table (claimed boolean, reason text, sequence_value bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request requests%rowtype;
  v_officer officers%rowtype;
  v_service lgu_services%rowtype;
  v_sequence bigint;
begin
  select * into v_officer from officers where egov_sub = p_officer_sub and role = 'officer';
  if not found then return query select false, 'FORBIDDEN', null::bigint; return; end if;

  select * into v_request from requests where id = p_request_id for update;
  if not found then return query select false, 'NOT_FOUND', null::bigint; return; end if;
  select * into v_service from lgu_services where id = v_request.lgu_service_id;

  if v_officer.lgu_id is null or v_officer.lgu_id <> v_service.lgu_id then
    return query select false, 'WRONG_LGU', null::bigint; return;
  end if;
  if v_officer.office is not null and trim(v_officer.office) <> '' and
     lower(trim(v_officer.office)) <> lower(trim(coalesce(v_service.approval_office, ''))) then
    return query select false, 'WRONG_OFFICE', null::bigint; return;
  end if;
  if not v_request.liveness_passed or coalesce(v_request.liveness_score, 95) < 95 then
    return query select false, 'LIVENESS_REQUIRED', null::bigint; return;
  end if;
  if v_request.fee_status not in ('paid','waived') then
    return query select false, 'PAYMENT_REQUIRED', null::bigint; return;
  end if;
  if v_request.status = 'issued' then
    return query select false, 'ALREADY_ISSUED', null::bigint; return;
  end if;
  if v_request.status not in ('submitted','approved') then
    return query select false, 'NOT_APPROVABLE', null::bigint; return;
  end if;
  if v_request.issuance_status = 'processing' and coalesce(v_request.issuance_started_at, now()) > now() - interval '5 minutes' then
    return query select false, 'IN_PROGRESS', null::bigint; return;
  end if;

  if v_request.control_number is null then
    insert into lgu_control_sequences (lgu_id, year, last_value)
      values (v_service.lgu_id, extract(year from now())::integer, 1)
    on conflict (lgu_id, year) do update
      set last_value = lgu_control_sequences.last_value + 1, updated_at = now()
    returning last_value into v_sequence;
  end if;

  update requests set
    status = 'approved',
    approved_by = coalesce(approved_by, p_officer_sub),
    approved_at = coalesce(approved_at, now()),
    issuance_status = 'processing',
    issuance_started_at = now(),
    issuance_attempts = issuance_attempts + 1,
    issuance_error = null
  where id = p_request_id;

  return query select true, 'CLAIMED', v_sequence;
end;
$$;
