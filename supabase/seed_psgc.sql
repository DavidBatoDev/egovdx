-- Minimal PSA geographic reference for officer onboarding.
-- Run after schema.sql and migration 002. Idempotent by PSGC code.

insert into psgc_reference (code, name, level, parent_code, region_code, province_code) values
  ('1300000000', 'National Capital Region', 'region', null, '1300000000', null),
  ('0300000000', 'Region III (Central Luzon)', 'region', null, '0300000000', null),
  ('0301400000', 'Bulacan', 'province', '0300000000', '0300000000', '0301400000'),
  ('1374000000', 'Mandaluyong City', 'city', '1300000000', '1300000000', null),
  ('0301401000', 'Angat', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301402000', 'Balagtas', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301403000', 'Baliwag City', 'city', '0301400000', '0300000000', '0301400000'),
  ('0301404000', 'Bocaue', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301405000', 'Bulacan', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301406000', 'Bustos', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301407000', 'Calumpit', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301408000', 'Guiguinto', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301409000', 'Hagonoy', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301411000', 'Marilao', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301413000', 'Norzagaray', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301414000', 'Obando', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301415000', 'Pandi', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301416000', 'Paombong', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301417000', 'Plaridel', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301419000', 'San Ildefonso', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301421000', 'San Miguel', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301423000', 'Santa Maria', 'municipality', '0301400000', '0300000000', '0301400000'),
  ('0301411001', 'Abangan Norte', 'barangay', '0301411000', '0300000000', '0301400000'),
  ('0301411002', 'Abangan Sur', 'barangay', '0301411000', '0300000000', '0301400000'),
  ('0301411003', 'Ibayo', 'barangay', '0301411000', '0300000000', '0301400000'),
  ('1374001014', 'Plainview', 'barangay', '1374000000', '1300000000', null)
on conflict (code) do update set
  name = excluded.name,
  level = excluded.level,
  parent_code = excluded.parent_code,
  region_code = excluded.region_code,
  province_code = excluded.province_code;
