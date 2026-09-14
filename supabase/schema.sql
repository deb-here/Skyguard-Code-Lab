-- Enable extension used for UUIDs
create extension if not exists "pgcrypto";

-- Rooms: one collaborative "lab" (a project/session)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

-- Membership: who can join a room, and their role
create table room_members (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

-- Files: each file's live Yjs state (as a base64 snapshot) plus metadata
create table files (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  filename text not null default 'main.py',
  language text not null default 'python',
  current_yjs_state text, -- base64-encoded Yjs update, written by the collab server
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- History: coarse-grained "who touched this file, and when" log.
-- snapshot holds the full text at that point; swap for a `diff` column
-- if you'd rather store deltas.
create table code_history (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references files(id) on delete cascade,
  user_id uuid references auth.users(id),
  snapshot text not null,
  created_at timestamptz default now()
);

-- Run results: optional log of code executions against the sandbox
create table run_results (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references files(id) on delete cascade,
  user_id uuid references auth.users(id),
  stdout text,
  stderr text,
  exit_code int,
  created_at timestamptz default now()
);

-- --- Row Level Security ---
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table files enable row level security;
alter table code_history enable row level security;
alter table run_results enable row level security;

-- Members can see rooms they belong to
create policy "select own rooms" on rooms
  for select using (
    exists (select 1 from room_members where room_id = rooms.id and user_id = auth.uid())
  );

-- Members can see/insert membership rows for their own rooms
create policy "select own membership" on room_members
  for select using (user_id = auth.uid());

-- Members can read/write files in rooms they belong to
create policy "select files in my rooms" on files
  for select using (
    exists (select 1 from room_members where room_id = files.room_id and user_id = auth.uid())
  );

create policy "update files in my rooms" on files
  for update using (
    exists (select 1 from room_members where room_id = files.room_id and user_id = auth.uid() and role in ('owner','editor'))
  );

-- History is readable by room members, insert restricted to service role (collab server)
create policy "select history in my rooms" on code_history
  for select using (
    exists (
      select 1 from files
      join room_members on room_members.room_id = files.room_id
      where files.id = code_history.file_id and room_members.user_id = auth.uid()
    )
  );

create policy "select run results in my rooms" on run_results
  for select using (
    exists (
      select 1 from files
      join room_members on room_members.room_id = files.room_id
      where files.id = run_results.file_id and room_members.user_id = auth.uid()
    )
  );
