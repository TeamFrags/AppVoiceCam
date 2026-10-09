create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One row per signed-in device. A session is also a refresh-token family.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  device_name text not null,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text
);
create index sessions_user_idx on sessions (user_id) where revoked_at is null;

-- Only SHA-256 hashes are stored; a database leak does not yield usable tokens.
create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index refresh_tokens_session_idx on refresh_tokens (session_id);

create table one_time_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- A ban is active while lifted_at is null and expires_at is null (permanent) or in the future.
create table bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('ban', 'suspension')),
  reason text not null,
  created_by uuid not null references users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references users (id)
);
create index bans_user_idx on bans (user_id) where lifted_at is null;

-- Server-side source of truth for Premium. Written only by the payment webhook (phase 7).
create table subscriptions (
  user_id uuid primary key references users (id) on delete cascade,
  status text not null check (status in ('active', 'past_due', 'canceled', 'expired')),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider_customer_id text,
  provider_subscription_id text,
  updated_at timestamptz not null default now()
);

create table security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  type text not null,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index security_events_user_idx on security_events (user_id, created_at desc);

-- Append-only trail of administrative actions.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references users (id),
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);
