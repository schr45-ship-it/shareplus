-- Allow session owners (and admins) to lock a discussion against forks
alter table havruta_sessions
  add column if not exists owner_key text,
  add column if not exists is_locked boolean not null default false;
