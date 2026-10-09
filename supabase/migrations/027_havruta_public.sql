-- Per-discussion privacy: private discussions are hidden from community listings
alter table havruta_sessions
  add column if not exists is_public boolean not null default true;

create index if not exists havruta_sessions_public_idx
  on havruta_sessions(is_public);
