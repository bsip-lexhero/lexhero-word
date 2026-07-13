alter table public.profiles
  add column if not exists full_name text;

alter table public.documents
  add column if not exists external_document_id text,
  add column if not exists source text not null default 'word';

alter table public.messages
  add column if not exists selected_text text,
  add column if not exists document_context text,
  add column if not exists citations jsonb not null default '[]'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb;

create table if not exists public.mcp_tool_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_name text not null,
  request_payload jsonb,
  response_payload jsonb,
  status text not null check (status in ('success', 'error', 'mocked', 'skipped')),
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

alter table public.mcp_tool_calls
  add column if not exists session_id uuid references public.chat_sessions(id) on delete cascade,
  add column if not exists request_payload jsonb,
  add column if not exists response_payload jsonb,
  add column if not exists error_message text,
  add column if not exists duration_ms integer;

create table if not exists public.webhook_tool_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_name text not null,
  status text not null check (status in ('success', 'error', 'mocked', 'skipped')),
  response_summary text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists mcp_calls_user_idx on public.mcp_tool_calls(user_id);
create index if not exists webhook_calls_user_idx on public.webhook_tool_calls(user_id);

alter table public.mcp_tool_calls enable row level security;
alter table public.webhook_tool_calls enable row level security;

drop policy if exists mcp_calls_own on public.mcp_tool_calls;
create policy mcp_calls_own on public.mcp_tool_calls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists webhook_calls_own on public.webhook_tool_calls;
create policy webhook_calls_own on public.webhook_tool_calls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
