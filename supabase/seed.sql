-- eGovDX Local — demo seed data
-- Run AFTER schema.sql. Safe to re-run.
--
-- Fixed UUIDs so the demo has stable, linkable URLs across re-seeds.
-- Deliberately seeds one PUBLISHED service (citizen flow works on first paint)
-- and one FLAGGED service (the review queue has something to review on camera).

truncate request_events, requests, validation_flags, lgu_services,
         service_templates, officers, lgus restart identity cascade;

-- ---------------------------------------------------------------- lgus
insert into lgus (id, name, type, parent_id, region, psgc_code) values
  ('11111111-1111-1111-1111-111111111111',
   'City of Mandaluyong', 'city', null, 'NCR', '1374000000'),
  ('22222222-2222-2222-2222-222222222222',
   'Barangay Plainview', 'barangay',
   '11111111-1111-1111-1111-111111111111', 'NCR', '1374001014'),
  ('33333333-3333-3333-3333-333333333333',
   'Barangay Hagdang Bato Itaas', 'barangay',
   '11111111-1111-1111-1111-111111111111', 'NCR', '1374001008');

-- ------------------------------------------------------------ officers
-- egov_sub values are placeholders. After your first real SSO login, update the
-- row for whichever account you demo with:
--   update officers set egov_sub = '<sub from callback log>' where role = 'officer';
insert into officers (id, egov_sub, lgu_id, full_name, position, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'demo-officer-sub',
   '22222222-2222-2222-2222-222222222222',
   'Maria Santos', 'Barangay Secretary', 'officer'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'demo-reviewer-sub',
   null, 'Jose Reyes', 'DICT Regional Focal Person', 'reviewer');

-- --------------------------------------------------- service_templates
-- base_fields drive the citizen form. allowed_rules is the bounded parameter
-- set — anything an LGU sets outside these bounds gets flagged for human review.
insert into service_templates (id, code, name, description, max_fee, base_fields, allowed_rules) values
(
  'bbbbbbbb-0000-0000-0000-000000000001',
  'BRGY_CLEARANCE', 'Barangay Clearance',
  'General-purpose clearance certifying good standing and residency.',
  100.00,
  '[
    {"key":"purpose","label":"Purpose of Request","type":"select","required":true,
     "options":["Employment","Business Permit","Bank Requirement","School","Travel","Others"]},
    {"key":"years_of_residency","label":"Years of Residency","type":"number","required":true,
     "source":"everify"},
    {"key":"full_name","label":"Full Name","type":"text","required":true,"source":"everify"},
    {"key":"address","label":"Complete Address","type":"text","required":true,"source":"everify"},
    {"key":"birthdate","label":"Date of Birth","type":"date","required":true,"source":"everify"}
  ]'::jsonb,
  '{
    "fee_range":[0,100],
    "waiver_categories":["student","senior_citizen","pwd","indigent","solo_parent"],
    "eligibility_keys":["min_residency_years","min_age"],
    "max_custom_fields":3
  }'::jsonb
),
(
  'bbbbbbbb-0000-0000-0000-000000000002',
  'INDIGENCY_CERT', 'Certificate of Indigency',
  'Certifies indigent status for medical, educational, or legal assistance.',
  0.00,
  '[
    {"key":"purpose","label":"Purpose of Request","type":"select","required":true,
     "options":["Medical Assistance","Educational Assistance","Legal Assistance","Burial Assistance"]},
    {"key":"monthly_income","label":"Declared Monthly Household Income","type":"number","required":true},
    {"key":"household_size","label":"Number of Household Members","type":"number","required":true},
    {"key":"full_name","label":"Full Name","type":"text","required":true,"source":"everify"},
    {"key":"address","label":"Complete Address","type":"text","required":true,"source":"everify"}
  ]'::jsonb,
  '{
    "fee_range":[0,0],
    "waiver_categories":["indigent"],
    "eligibility_keys":["min_residency_years","max_monthly_income"],
    "max_custom_fields":2
  }'::jsonb
),
(
  'bbbbbbbb-0000-0000-0000-000000000003',
  'BIZ_PERMIT_ENDORSE', 'Business Permit Endorsement',
  'Barangay-level endorsement required before a city business permit is issued.',
  500.00,
  '[
    {"key":"business_name","label":"Business Name","type":"text","required":true},
    {"key":"business_type","label":"Nature of Business","type":"text","required":true},
    {"key":"business_address","label":"Business Address","type":"text","required":true},
    {"key":"capital","label":"Declared Capital (PHP)","type":"number","required":true},
    {"key":"full_name","label":"Owner Full Name","type":"text","required":true,"source":"everify"}
  ]'::jsonb,
  '{
    "fee_range":[0,500],
    "waiver_categories":["barangay_micro_business"],
    "eligibility_keys":["min_residency_years"],
    "max_custom_fields":4
  }'::jsonb
);

-- -------------------------------------------------------- lgu_services
insert into lgu_services
  (id, lgu_id, template_id, display_name, status, fee_amount, waivers, required_docs,
   eligibility, form_fields, submitted_at, published_at) values
(
  -- PUBLISHED: the citizen demo path. Live on first paint.
  'cccccccc-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'Barangay Clearance',
  'published', 50.00,
  '[{"category":"student","label":"Student (with valid ID)","waives":"full"},
    {"category":"senior_citizen","label":"Senior Citizen","waives":"full"}]'::jsonb,
  '["Valid government-issued ID"]'::jsonb,
  '{"min_residency_years":1}'::jsonb,
  '[
    {"key":"purpose","label":"Purpose of Request","type":"select","required":true,
     "options":["Employment","Business Permit","Bank Requirement","School","Travel","Others"]},
    {"key":"full_name","label":"Full Name","type":"text","required":true,"source":"everify"},
    {"key":"address","label":"Complete Address","type":"text","required":true,"source":"everify"},
    {"key":"birthdate","label":"Date of Birth","type":"date","required":true,"source":"everify"},
    {"key":"years_of_residency","label":"Years of Residency","type":"number","required":true,
     "source":"everify"}
  ]'::jsonb,
  now() - interval '3 days', now() - interval '2 days'
),
(
  -- PUBLISHED: zero-fee indigency. Shows the waiver path with no payment step.
  'cccccccc-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'Certificate of Indigency',
  'published', 0.00,
  '[{"category":"indigent","label":"Indigent Household","waives":"full"}]'::jsonb,
  '["Barangay Certificate of Residency (if available)"]'::jsonb,
  '{"min_residency_years":1,"max_monthly_income":15000}'::jsonb,
  '[
    {"key":"purpose","label":"Purpose of Request","type":"select","required":true,
     "options":["Medical Assistance","Educational Assistance","Legal Assistance","Burial Assistance"]},
    {"key":"monthly_income","label":"Declared Monthly Household Income","type":"number","required":true},
    {"key":"household_size","label":"Number of Household Members","type":"number","required":true},
    {"key":"full_name","label":"Full Name","type":"text","required":true,"source":"everify"},
    {"key":"address","label":"Complete Address","type":"text","required":true,"source":"everify"}
  ]'::jsonb,
  now() - interval '3 days', now() - interval '2 days'
),
(
  -- FLAGGED: sits in the DICT review queue on camera. Two deliberate violations:
  -- fee 750 exceeds the template ceiling of 500, and "OFW" is not an approved
  -- waiver category. This is the "oversight still exists" moment in the demo.
  'cccccccc-0000-0000-0000-000000000003',
  '33333333-3333-3333-3333-333333333333',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'Business Permit Endorsement',
  'flagged', 750.00,
  '[{"category":"OFW","label":"Overseas Filipino Worker","waives":"full"}]'::jsonb,
  '["DTI Business Name Registration","Lease Contract or Land Title"]'::jsonb,
  '{"min_residency_years":2}'::jsonb,
  '[
    {"key":"business_name","label":"Business Name","type":"text","required":true},
    {"key":"business_type","label":"Nature of Business","type":"text","required":true},
    {"key":"business_address","label":"Business Address","type":"text","required":true},
    {"key":"capital","label":"Declared Capital (PHP)","type":"number","required":true},
    {"key":"full_name","label":"Owner Full Name","type":"text","required":true,"source":"everify"}
  ]'::jsonb,
  now() - interval '4 hours', null
);

-- ---------------------------------------------------- validation_flags
insert into validation_flags (lgu_service_id, rule_code, severity, message, field_path) values
('cccccccc-0000-0000-0000-000000000003', 'FEE_ABOVE_TEMPLATE_CEILING', 'block',
 'Fee of PHP 750.00 exceeds the DICT-approved ceiling of PHP 500.00 for this service.',
 'fee_amount'),
('cccccccc-0000-0000-0000-000000000003', 'UNKNOWN_WAIVER_CATEGORY', 'block',
 'Waiver category "OFW" is not in the approved category list for this template.',
 'waivers[0].category'),
('cccccccc-0000-0000-0000-000000000003', 'ELIGIBILITY_ABOVE_TYPICAL', 'warn',
 'Minimum residency of 2 years is longer than the 1-year national norm for this service.',
 'eligibility.min_residency_years');
