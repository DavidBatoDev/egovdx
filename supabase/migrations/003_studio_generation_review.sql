-- AI Studio cache, provenance, auditable validation resolution, and atomic publication.
alter table lgu_services add column if not exists generation_confidence numeric(4,3);
alter table lgu_services add column if not exists reviewed_by text;
alter table lgu_services add column if not exists reviewed_at timestamptz;

alter table validation_flags add column if not exists resolution_note text;
alter table validation_flags add column if not exists resolved_by text;
alter table validation_flags add column if not exists resolved_at timestamptz;
alter table validation_flags drop constraint if exists validation_flag_resolution_audit;
alter table validation_flags add constraint validation_flag_resolution_audit check (
  not resolved or (length(trim(resolution_note)) > 0 and resolved_by is not null and resolved_at is not null)
);

create table if not exists studio_generation_cache (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid not null references lgus(id) on delete cascade,
  input_kind text not null check (input_kind in ('prompt','extraction')),
  input_hash text not null,
  result jsonb not null,
  engine text not null check (engine in ('egov-ai','openai','mock')),
  model text not null,
  source text not null check (source in ('live','mock','fallback')),
  primary_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lgu_id, input_kind, input_hash)
);

create or replace function save_generated_service(
  p_lgu_id uuid,
  p_template_code text,
  p_service jsonb,
  p_flags jsonb,
  p_source_prompt text,
  p_generated_by text,
  p_generator_model text
) returns table(service_id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_template_id uuid;
  v_service_id uuid;
  v_status text;
  v_flag jsonb;
begin
  select id into v_template_id from service_templates where code = p_template_code;
  if v_template_id is null then raise exception 'Unknown template code'; end if;
  v_status := case when exists (
    select 1 from jsonb_array_elements(p_flags) f where f->>'severity' = 'block'
  ) then 'flagged' else 'published' end;

  insert into lgu_services (
    lgu_id, template_id, status, fee_amount, waivers, required_docs, eligibility,
    form_fields, source_prompt, generated_by, generator_model, approval_office,
    generation_confidence, submitted_at, published_at
  ) values (
    p_lgu_id, v_template_id, v_status, (p_service->>'feeAmount')::numeric,
    p_service->'waivers', p_service->'requiredDocs', p_service->'eligibility',
    p_service->'formFields', p_source_prompt, p_generated_by, p_generator_model,
    nullif(p_service->>'approvalOffice',''), (p_service->>'confidence')::numeric,
    now(), case when v_status = 'published' then now() else null end
  ) on conflict (lgu_id, template_id) do update set
    status = excluded.status, fee_amount = excluded.fee_amount, waivers = excluded.waivers,
    required_docs = excluded.required_docs, eligibility = excluded.eligibility,
    form_fields = excluded.form_fields, source_prompt = excluded.source_prompt,
    generated_by = excluded.generated_by, generator_model = excluded.generator_model,
    approval_office = excluded.approval_office,
    generation_confidence = excluded.generation_confidence, submitted_at = now(),
    published_at = excluded.published_at, reviewed_by = null, reviewed_at = null
  returning id into v_service_id;

  delete from validation_flags where lgu_service_id = v_service_id;
  for v_flag in select * from jsonb_array_elements(p_flags) loop
    insert into validation_flags(lgu_service_id, rule_code, severity, message, field_path)
    values (v_service_id, v_flag->>'ruleCode', v_flag->>'severity', v_flag->>'message', v_flag->>'fieldPath');
  end loop;
  return query select v_service_id, v_status;
end $$;

create or replace function publish_reviewed_service(p_service_id uuid, p_reviewer text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from validation_flags where lgu_service_id = p_service_id and severity = 'block' and not resolved) then
    raise exception 'Unresolved blocking validation flags remain';
  end if;
  update lgu_services set status = 'published', published_at = now(), reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_service_id and status = 'flagged';
  if not found then raise exception 'Flagged service not found'; end if;
  return 'published';
end $$;
