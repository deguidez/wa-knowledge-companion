ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS routing_flow jsonb NOT NULL DEFAULT '{"greeting":"Olá! Tudo bem? Para que eu possa direcionar o seu atendimento corretamente, me conte sobre qual área você precisa falar?","menu_title":"Escolha uma opção:","other_message":"Vou encaminhar seu atendimento para um atendente. Envie sua dúvida por aqui.","association":{"label":"Associação Pace 3","welcome":"Você está falando com a Associação Pace 3. Como podemos ajudar?","instructions":"Responda apenas sobre a Associação Pace 3."},"events":{"label":"Pace 3 Eventos Esportivos","welcome":"Você está falando com a Pace 3 Eventos Esportivos. Como podemos ajudar?","instructions":"Responda apenas sobre a Pace 3 Eventos Esportivos."}}'::jsonb;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS company_selected_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.knowledge_items ADD COLUMN IF NOT EXISTS company text;
CREATE OR REPLACE FUNCTION public.webhook_ingest(_token text, _phone text, _name text, _body text, _external_id text, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
 s public.settings; conv public.conversations; inserted int; hist jsonb; kb jsonb; flow jsonb; choice text; selected text; direct_reply text;
BEGIN
 SELECT * INTO s FROM public.settings WHERE id = 1;
 IF s IS NULL OR _token IS NULL OR length(_token) < 16 OR _token <> s.webhook_token THEN
  RAISE EXCEPTION 'invalid token' USING errcode = '28000';
 END IF;
 INSERT INTO public.webhook_events(event, payload, processed_at) VALUES ('message', coalesce(_payload, '{}'::jsonb), now());
 INSERT INTO public.conversations(phone, name, last_message_at) VALUES (_phone, nullif(_name,''), now())
 ON CONFLICT (phone) DO UPDATE SET last_message_at = now(), name = coalesce(nullif(excluded.name,''), public.conversations.name)
 RETURNING * INTO conv;
 INSERT INTO public.messages(conversation_id, external_id, direction, body, company)
 VALUES (conv.id, _external_id, 'in', _body, conv.company) ON CONFLICT (external_id) DO NOTHING;
 GET DIAGNOSTICS inserted = row_count;
 IF inserted = 0 THEN RETURN jsonb_build_object('duplicate', true); END IF;
 flow := s.routing_flow;
 choice := lower(trim(_body));
 IF choice IN ('0', 'menu', 'inicio', 'início', 'trocar empresa') THEN
  UPDATE public.conversations SET company = NULL, company_selected_at = NULL WHERE id = conv.id;
  conv.company := NULL;
  UPDATE public.messages SET company = NULL WHERE external_id = _external_id;
 END IF;
 IF s.auto_reply AND NOT conv.ai_paused THEN
  IF conv.company IS NULL THEN
   selected := CASE choice WHEN '1' THEN 'association' WHEN '2' THEN 'events' WHEN '3' THEN 'other' ELSE NULL END;
   IF selected IS NOT NULL THEN
    UPDATE public.conversations SET company = selected, company_selected_at = now() WHERE id = conv.id RETURNING * INTO conv;
    UPDATE public.messages SET company = selected WHERE external_id = _external_id;
    direct_reply := CASE WHEN selected = 'other' THEN flow->>'other_message' ELSE flow->selected->>'welcome' END;
   ELSE
    direct_reply := (flow->>'greeting') || E'\n\n' || (flow->>'menu_title') || E'\n1 - ' || (flow->'association'->>'label') || E'\n2 - ' || (flow->'events'->>'label') || E'\n3 - Outros';
   END IF;
  ELSIF conv.company = 'other' THEN
   direct_reply := flow->>'other_message';
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('direction', direction, 'body', body) ORDER BY created_at), '[]'::jsonb) INTO hist
 FROM (SELECT direction, body, created_at FROM public.messages WHERE conversation_id = conv.id AND company = conv.company AND created_at >= conv.company_selected_at ORDER BY created_at DESC LIMIT 12) h;
 SELECT coalesce(jsonb_agg(jsonb_build_object('title', title, 'content', left(content, 200000))), '[]'::jsonb) INTO kb
 FROM public.knowledge_items WHERE company = conv.company AND company IN ('association', 'events');
 RETURN jsonb_build_object('duplicate', false, 'reply', s.auto_reply AND NOT conv.ai_paused, 'conversation_id', conv.id, 'company', conv.company, 'direct_reply', direct_reply, 'history', hist, 'knowledge', kb, 'settings', jsonb_build_object(
 'agent_name', s.agent_name, 'system_prompt', s.system_prompt,
 'company_name', flow->conv.company->>'label', 'company_instructions', flow->conv.company->>'instructions',
 'whatsapp_provider', s.whatsapp_provider, 'ycloud_api_key', s.ycloud_api_key, 'ycloud_from', s.ycloud_from,
 'evolution_url', s.evolution_url, 'evolution_api_key', s.evolution_api_key, 'evolution_instance', s.evolution_instance,
 'ai_provider', s.ai_provider, 'ai_base_url', s.ai_base_url, 'ai_api_key', s.ai_api_key, 'ai_model', s.ai_model));
END $function$;
CREATE OR REPLACE FUNCTION public.webhook_record_reply(_token text, _conversation_id uuid, _body text, _status text, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s public.settings;
BEGIN
 SELECT * INTO s FROM public.settings WHERE id = 1;
 IF _token IS NULL OR _token <> s.webhook_token THEN RAISE EXCEPTION 'invalid token' USING errcode = '28000'; END IF;
 INSERT INTO public.messages(conversation_id, direction, body, status, error, company)
 SELECT id, 'out', coalesce(_body,''), coalesce(_status,'ok'), _error, company FROM public.conversations WHERE id = _conversation_id;
 UPDATE public.conversations SET last_message_at = now() WHERE id = _conversation_id;
END $function$;