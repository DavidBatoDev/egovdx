-- Apply to an existing eGovDX database without resetting other hackathon data.

create table if not exists egov_identities (
  id          uuid primary key default gen_random_uuid(),
  egov_sub    text unique not null,
  full_name   text not null,
  first_name  text not null,
  middle_name text not null,
  last_name   text not null,
  suffix      text,
  birthdate   date,
  address     text,
  email       text,
  mobile      text,
  source      text not null check (source in ('live','mock','fallback')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists egov_identities_email_idx on egov_identities(email);

alter table officers alter column egov_sub drop not null;
alter table officers add column if not exists sso_email text;
alter table officers add column if not exists sso_birthdate date;

create unique index if not exists officers_sso_profile_unique
  on officers (lower(sso_email), sso_birthdate)
  where sso_email is not null and sso_birthdate is not null;
