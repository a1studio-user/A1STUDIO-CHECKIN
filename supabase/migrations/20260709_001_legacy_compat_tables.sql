-- Compatibility tables for the pixel-identical legacy UI inside the iOS test app.
-- These live only in the new Supabase project so the existing production PWA remains untouched.

create table if not exists app_users (
  username text primary key,
  password text not null,
  role text not null check (role in ('teacher', 'student', 'owner')),
  updated_at timestamptz not null default now()
);

create table if not exists daily_tasks (
  task_date text primary key,
  homework text not null default '',
  dictation text not null default '',
  recite text not null default '',
  speaking text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists student_tasks (
  username text not null,
  task_date text not null,
  homework text not null default '',
  dictation text not null default '',
  recite text not null default '',
  speaking text not null default '',
  updated_at timestamptz not null default now(),
  primary key (username, task_date)
);

create table if not exists checkins (
  username text not null,
  checkin_date date not null,
  homework boolean not null default false,
  dictation boolean not null default false,
  recite boolean not null default false,
  speaking boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (username, checkin_date)
);

create table if not exists streaks (
  username text primary key,
  streak integer not null default 0,
  flowers integer not null default 0,
  last_checkin_date date,
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id text primary key,
  username text not null,
  role text not null check (role in ('teacher', 'student', 'owner')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists hidden_chat_messages (
  username text not null,
  message_key text not null,
  hidden_at timestamptz not null default now(),
  primary key (username, message_key)
);

alter table app_users enable row level security;
alter table daily_tasks enable row level security;
alter table student_tasks enable row level security;
alter table checkins enable row level security;
alter table streaks enable row level security;
alter table chat_messages enable row level security;
alter table hidden_chat_messages enable row level security;

drop policy if exists "legacy compat app_users all" on app_users;
create policy "legacy compat app_users all" on app_users for all using (true) with check (true);

drop policy if exists "legacy compat daily_tasks all" on daily_tasks;
create policy "legacy compat daily_tasks all" on daily_tasks for all using (true) with check (true);

drop policy if exists "legacy compat student_tasks all" on student_tasks;
create policy "legacy compat student_tasks all" on student_tasks for all using (true) with check (true);

drop policy if exists "legacy compat checkins all" on checkins;
create policy "legacy compat checkins all" on checkins for all using (true) with check (true);

drop policy if exists "legacy compat streaks all" on streaks;
create policy "legacy compat streaks all" on streaks for all using (true) with check (true);

drop policy if exists "legacy compat chat_messages all" on chat_messages;
create policy "legacy compat chat_messages all" on chat_messages for all using (true) with check (true);

drop policy if exists "legacy compat hidden_chat_messages all" on hidden_chat_messages;
create policy "legacy compat hidden_chat_messages all" on hidden_chat_messages for all using (true) with check (true);
