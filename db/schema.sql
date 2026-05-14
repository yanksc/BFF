create table if not exists users (
  id text primary key,
  name text not null,
  companion_name text not null,
  companion_gender text not null,
  fitness_goal text not null,
  workout_frequency text not null,
  tone text not null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists messages_user_created on messages(user_id, created_at);

create table if not exists memories (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  memory text not null,
  created_at timestamptz not null default now()
);
create index if not exists memories_user_created on memories(user_id, created_at);
