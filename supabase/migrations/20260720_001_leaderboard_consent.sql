-- Public leaderboard entries are intentionally separate from private learning progress.
-- The client writes an entry only after the student has explicitly opted in.

create table if not exists leaderboard_entries (
  username text primary key,
  flowers integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table leaderboard_entries enable row level security;

drop policy if exists "legacy leaderboard entries all" on leaderboard_entries;
create policy "legacy leaderboard entries all" on leaderboard_entries
  for all using (true) with check (true);
