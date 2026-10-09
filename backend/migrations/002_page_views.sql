-- Website audience measurement. Rows are only written for visitors who accepted analytics
-- cookies. No IP address, no user agent, no account link: just an anonymous visitor id.
create table page_views (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  path text not null,
  referrer_host text,
  created_at timestamptz not null default now()
);
create index page_views_created_idx on page_views (created_at);
