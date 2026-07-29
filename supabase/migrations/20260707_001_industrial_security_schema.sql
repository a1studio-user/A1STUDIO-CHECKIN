-- Industrial schema for A1 STUDIO check-in app.
-- Keep legacy tables intact during migration. New app code should use these v2 tables.

create extension if not exists pgcrypto;

create type app_role as enum ('owner', 'teacher', 'student');
create type app_program as enum ('italian', 'portfolio');
create type task_target_type as enum ('default', 'class', 'student');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role app_role not null default 'student',
  programs jsonb not null default '{"italian": true, "portfolio": false}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists class_members (
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  program app_program not null,
  target_type task_target_type not null,
  target_id uuid not null default '00000000-0000-0000-0000-000000000000',
  italian_homework text not null default '',
  italian_words text not null default '',
  italian_written text not null default '',
  portfolio_text text not null default '',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_target_unique unique (task_date, target_type, target_id, program)
);

create table if not exists checkins_v2 (
  student_id uuid not null references profiles(id) on delete cascade,
  checkin_date date not null,
  italian_homework boolean not null default false,
  italian_words boolean not null default false,
  italian_written boolean not null default false,
  portfolio_done boolean not null default false,
  checked_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (student_id, checkin_date)
);

create table if not exists streaks_v2 (
  student_id uuid primary key references profiles(id) on delete cascade,
  streak integer not null default 0,
  bravos integer not null default 0,
  last_checkin_date date,
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages_v2 (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  message text not null check (length(message) <= 1000),
  is_deleted boolean not null default false,
  deleted_by uuid references auth.users(id),
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages_v2(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on profiles;
create trigger profiles_touch_updated_at before update on profiles for each row execute function touch_updated_at();

drop trigger if exists classes_touch_updated_at on classes;
create trigger classes_touch_updated_at before update on classes for each row execute function touch_updated_at();

drop trigger if exists tasks_touch_updated_at on tasks;
create trigger tasks_touch_updated_at before update on tasks for each row execute function touch_updated_at();

drop trigger if exists chat_messages_touch_updated_at on chat_messages_v2;
create trigger chat_messages_touch_updated_at before update on chat_messages_v2 for each row execute function touch_updated_at();

create or replace function current_app_role()
returns app_role language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_teacher_or_owner()
returns boolean language sql stable security definer as $$
  select coalesce((select role in ('owner', 'teacher') from profiles where id = auth.uid()), false)
$$;

alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table tasks enable row level security;
alter table checkins_v2 enable row level security;
alter table streaks_v2 enable row level security;
alter table chat_messages_v2 enable row level security;
alter table chat_reports enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "profiles self read" on profiles;
create policy "profiles self read" on profiles for select using (id = auth.uid() or is_teacher_or_owner());

drop policy if exists "profiles teacher write" on profiles;
create policy "profiles teacher write" on profiles for all using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "classes teacher read" on classes;
create policy "classes teacher read" on classes for select using (is_teacher_or_owner());

drop policy if exists "classes teacher write" on classes;
create policy "classes teacher write" on classes for all using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "class_members teacher read" on class_members;
create policy "class_members teacher read" on class_members for select using (is_teacher_or_owner());

drop policy if exists "class_members teacher write" on class_members;
create policy "class_members teacher write" on class_members for all using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "tasks read own or teacher" on tasks;
create policy "tasks read own or teacher" on tasks for select using (
  is_teacher_or_owner()
  or target_type = 'default'
  or (target_type = 'student' and target_id = auth.uid())
  or (
    target_type = 'class'
    and exists (
      select 1 from class_members cm
      where cm.class_id = tasks.target_id and cm.student_id = auth.uid()
    )
  )
);

drop policy if exists "tasks teacher write" on tasks;
create policy "tasks teacher write" on tasks for all using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "checkins read own or teacher" on checkins_v2;
create policy "checkins read own or teacher" on checkins_v2 for select using (student_id = auth.uid() or is_teacher_or_owner());

drop policy if exists "checkins teacher write" on checkins_v2;
create policy "checkins teacher write" on checkins_v2 for all using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "streaks read own or teacher" on streaks_v2;
create policy "streaks read own or teacher" on streaks_v2 for select using (student_id = auth.uid() or is_teacher_or_owner());

drop policy if exists "streaks teacher write" on streaks_v2;
create policy "streaks teacher write" on streaks_v2 for all using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "chat read all authenticated" on chat_messages_v2;
create policy "chat read all authenticated" on chat_messages_v2 for select using (auth.uid() is not null and is_deleted = false);

drop policy if exists "chat send own" on chat_messages_v2;
create policy "chat send own" on chat_messages_v2 for insert with check (sender_id = auth.uid());

drop policy if exists "chat teacher moderate" on chat_messages_v2;
create policy "chat teacher moderate" on chat_messages_v2 for update using (is_teacher_or_owner()) with check (is_teacher_or_owner());

drop policy if exists "reports insert own" on chat_reports;
create policy "reports insert own" on chat_reports for insert with check (reporter_id = auth.uid());

drop policy if exists "reports teacher read" on chat_reports;
create policy "reports teacher read" on chat_reports for select using (is_teacher_or_owner());

drop policy if exists "audit teacher read" on audit_logs;
create policy "audit teacher read" on audit_logs for select using (is_teacher_or_owner());

-- Legacy public policies from supabase_schema.sql should be removed only after the frontend has fully migrated.
-- Do not drop legacy tables until data import is verified.
