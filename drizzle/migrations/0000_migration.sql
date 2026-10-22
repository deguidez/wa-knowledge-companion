create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- first user becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
  for each row execute function public.handle_first_admin();

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.admin_exists() to anon, authenticated;

-- settings singleton
create table public.settings (
  id int primary key default 1 check (id = 1),
  agent_name text not null default 'Assistente',
  system_prompt text not null default 'Você é um assistente de atendimento educado e objetivo. Responda em português do Brasil, de forma curta, usando apenas as informações da base de conhecimento. Se não souber, diga que vai verificar com um atendente.',
  auto_reply boolean not null default true,
  evolution_url text not null default '',
  evolution_api_key text not null default '',
  evolution_instance text not null default '',
  ai_provider text not null default 'lovable',
  ai_base_url text not null default 'https://api.openai.com/v1',
  ai_api_key text not null default '',
  ai_model text not null default 'gpt-4o-mini',
  webhook_token text not null default encode(gen_random_bytes(24), 'hex'),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);
grant select, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "admin settings" on public.settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('text','pdf','url','file')),
  title text not null,
  source text,
  file_path text,
  content text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.knowledge_items to authenticated;
grant all on public.knowledge_items to service_role;
alter table public.knowledge_items enable row level security;
create policy "admin knowledge" on public.knowledge_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  ai_paused boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "admin conversations" on public.conversations for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  external_id text unique,
  direction text not null check (direction in ('in','out')),
  body text not null,
  status text not null default 'ok',
  error text,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "admin messages" on public.messages for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event text,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now()
);
grant select on public.webhook_events to authenticated;
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;
create policy "admin events" on public.webhook_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admin knowledge files read" on storage.objects for select to authenticated
  using (bucket_id = 'knowledge' and public.has_role(auth.uid(), 'admin'));
create policy "admin knowledge files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge' and public.has_role(auth.uid(), 'admin'));
create policy "admin knowledge files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge' and public.has_role(auth.uid(), 'admin'));
