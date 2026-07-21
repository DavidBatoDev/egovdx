-- Dedicated create flows, persisted document templates, and safe service revisions.
alter table lgu_services drop constraint if exists lgu_services_lgu_id_template_id_key;
alter table lgu_services drop constraint if exists lgu_services_status_check;
alter table lgu_services add constraint lgu_services_status_check
  check (status in ('draft','flagged','published','rejected','archived'));
alter table lgu_services add column if not exists display_name text;
alter table lgu_services add column if not exists version integer not null default 1;
alter table lgu_services add column if not exists supersedes_service_id uuid references lgu_services(id) on delete set null;
update lgu_services s set display_name = t.name
from service_templates t where s.template_id = t.id and s.display_name is null;
alter table lgu_services alter column display_name set not null;

create unique index if not exists lgu_services_one_published
  on lgu_services(lgu_id, template_id) where status = 'published';
create unique index if not exists lgu_services_one_pending
  on lgu_services(lgu_id, template_id) where status in ('draft','flagged');

drop function if exists save_generated_service(uuid,text,jsonb,jsonb,text,text,text);
create or replace function save_generated_service(
  p_lgu_id uuid,
  p_template_code text,
  p_service jsonb,
  p_flags jsonb,
  p_source_prompt text,
  p_generated_by text,
  p_generator_model text,
  p_doc_template_path text,
  p_supersedes_service_id uuid default null
) returns table(service_id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_template_id uuid;
  v_service_id uuid;
  v_status text;
  v_version integer := 1;
  v_flag jsonb;
  v_previous lgu_services%rowtype;
  v_supersedes_service_id uuid;
begin
  select id into v_template_id from service_templates where code = p_template_code;
  if v_template_id is null then raise exception 'Unknown template code'; end if;

  if p_supersedes_service_id is not null then
    select * into v_previous from lgu_services
      where id = p_supersedes_service_id and lgu_id = p_lgu_id;
    if not found then raise exception 'Service revision target not found'; end if;
    if v_previous.template_id <> v_template_id then raise exception 'A revision cannot change its DICT template'; end if;
    if v_previous.status in ('draft','flagged') then
      v_version := v_previous.version;
      v_supersedes_service_id := v_previous.supersedes_service_id;
      delete from lgu_services where id = v_previous.id;
    else
      v_version := v_previous.version + 1;
      v_supersedes_service_id := v_previous.id;
      delete from lgu_services where lgu_id = p_lgu_id and template_id = v_template_id
        and status in ('draft','flagged');
    end if;
  elsif exists (
    select 1 from lgu_services where lgu_id = p_lgu_id and template_id = v_template_id
      and status in ('published','draft','flagged')
  ) then
    raise exception 'This LGU already has this service template; revise the existing service instead';
  end if;

  v_status := case when exists (
    select 1 from jsonb_array_elements(p_flags) f where f->>'severity' = 'block'
  ) then 'flagged' else 'published' end;

  if v_status = 'published' then
    update lgu_services set status = 'archived'
      where lgu_id = p_lgu_id and template_id = v_template_id and status = 'published';
  end if;

  insert into lgu_services (
    lgu_id, template_id, display_name, version, supersedes_service_id, status,
    fee_amount, waivers, required_docs, eligibility, form_fields, doc_template_path,
    source_prompt, generated_by, generator_model, approval_office,
    generation_confidence, submitted_at, published_at
  ) values (
    p_lgu_id, v_template_id, p_service->>'name', v_version, v_supersedes_service_id, v_status,
    (p_service->>'feeAmount')::numeric, p_service->'waivers', p_service->'requiredDocs',
    p_service->'eligibility', p_service->'formFields', p_doc_template_path,
    p_source_prompt, p_generated_by, p_generator_model,
    nullif(p_service->>'approvalOffice',''), (p_service->>'confidence')::numeric,
    now(), case when v_status = 'published' then now() else null end
  ) returning id into v_service_id;

  for v_flag in select * from jsonb_array_elements(p_flags) loop
    insert into validation_flags(lgu_service_id, rule_code, severity, message, field_path)
    values (v_service_id, v_flag->>'ruleCode', v_flag->>'severity', v_flag->>'message', v_flag->>'fieldPath');
  end loop;
  return query select v_service_id, v_status;
end $$;

create or replace function publish_reviewed_service(p_service_id uuid, p_reviewer text)
returns text language plpgsql security definer set search_path = public as $$
declare v_service lgu_services%rowtype;
begin
  if exists (select 1 from validation_flags where lgu_service_id = p_service_id and severity = 'block' and not resolved) then
    raise exception 'Unresolved blocking validation flags remain';
  end if;
  select * into v_service from lgu_services where id = p_service_id and status = 'flagged' for update;
  if not found then raise exception 'Flagged service not found'; end if;
  update lgu_services set status = 'archived'
    where lgu_id = v_service.lgu_id and template_id = v_service.template_id
      and status = 'published' and id <> p_service_id;
  update lgu_services set status = 'published', published_at = now(), reviewed_by = p_reviewer, reviewed_at = now()
    where id = p_service_id;
  return 'published';
end $$;
