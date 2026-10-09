-- Applications to the creator program, sent from the website form. Only what the applicant
-- typed is kept: no IP address, no user agent, no account link.
create table creator_applications (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  platform text not null,
  channel_url text not null,
  message text,
  locale text,
  created_at timestamptz not null default now()
);
create index creator_applications_created_idx on creator_applications (created_at);
