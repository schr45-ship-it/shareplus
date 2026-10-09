-- Link discussions to registered users (Supabase auth.users)
alter table havruta_sessions
  add column if not exists user_id uuid;

create index if not exists havruta_sessions_user_id_idx
  on havruta_sessions(user_id);
