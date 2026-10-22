create or replace function public.webhook_ingest(_token text, _phone text, _name text, _body text, _external_id text, _payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  conv public.conversations;
  inserted int;
  hist jsonb;
  kb jsonb;
begin
  select * into s from public.settings where id = 1;
  if s is null or _token is null or length(_token) < 16 or _token <> s.webhook_token then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  insert into public.webhook_events(event, payload, processed_at) values ('messages.upsert', coalesce(_payload, '{}'::jsonb), now());

  insert into public.conversations(phone, name, last_message_at) values (_phone, nullif(_name,''), now())
  on conflict (phone) do update set last_message_at = now(), name = coalesce(nullif(excluded.name,''), public.conversations.name)
  returning * into conv;

  insert into public.messages(conversation_id, external_id, direction, body)
  values (conv.id, _external_id, 'in', _body)
  on conflict (external_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('duplicate', true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('direction', direction, 'body', body) order by created_at), '[]'::jsonb) into hist
  from (select direction, body, created_at from public.messages where conversation_id = conv.id order by created_at desc limit 12) h;

  select coalesce(jsonb_agg(jsonb_build_object('title', title, 'content', left(content, 200000))), '[]'::jsonb) into kb
  from public.knowledge_items;

  return jsonb_build_object(
    'duplicate', false,
    'reply', s.auto_reply and not conv.ai_paused,
    'conversation_id', conv.id,
    'history', hist,
    'knowledge', kb,
    'settings', jsonb_build_object(
      'agent_name', s.agent_name, 'system_prompt', s.system_prompt,
      'evolution_url', s.evolution_url, 'evolution_api_key', s.evolution_api_key, 'evolution_instance', s.evolution_instance,
      'ai_provider', s.ai_provider, 'ai_base_url', s.ai_base_url, 'ai_api_key', s.ai_api_key, 'ai_model', s.ai_model)
  );
end $$;

create or replace function public.webhook_record_reply(_token text, _conversation_id uuid, _body text, _status text, _error text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.settings;
begin
  select * into s from public.settings where id = 1;
  if _token is null or _token <> s.webhook_token then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  insert into public.messages(conversation_id, direction, body, status, error)
  values (_conversation_id, 'out', coalesce(_body,''), coalesce(_status,'ok'), _error);
  update public.conversations set last_message_at = now() where id = _conversation_id;
end $$;

revoke all on function public.webhook_ingest(text,text,text,text,text,jsonb) from public;
revoke all on function public.webhook_record_reply(text,uuid,text,text,text) from public;
grant execute on function public.webhook_ingest(text,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.webhook_record_reply(text,uuid,text,text,text) to anon, authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
