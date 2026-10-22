ALTER TABLE public.settings ADD COLUMN followup_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.conversations ADD COLUMN followup_claimed_for timestamptz;
CREATE OR REPLACE FUNCTION public.webhook_claim_followups(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE s public.settings; jobs jsonb;
BEGIN
 SELECT * INTO s FROM public.settings WHERE id=1;
 IF _token IS NULL OR length(_token)<16 OR _token<>s.webhook_token THEN RAISE EXCEPTION 'invalid token' USING errcode='28000'; END IF;
 UPDATE public.conversations SET company=NULL, company_selected_at=NULL WHERE company IS NOT NULL AND last_client_message_at <= now()-make_interval(mins=>s.conversation_timeout_minutes);
 IF NOT s.auto_reply OR NOT s.followup_enabled THEN RETURN jsonb_build_object('jobs','[]'::jsonb); END IF;
 WITH due AS (
 SELECT c.id FROM public.conversations c
 JOIN LATERAL (SELECT created_at FROM public.messages WHERE conversation_id=c.id AND direction='out' AND status='ok' ORDER BY created_at DESC LIMIT 1) m ON true
 WHERE c.company IN ('association','events') AND NOT c.ai_paused
 AND c.last_client_message_at > now()-make_interval(mins=>s.conversation_timeout_minutes)
 AND m.created_at >= c.last_client_message_at AND m.created_at <= now()-interval '30 seconds'
 AND c.followup_claimed_for IS DISTINCT FROM c.last_client_message_at
 ORDER BY c.last_client_message_at LIMIT 20 FOR UPDATE OF c SKIP LOCKED
 ), claimed AS (
 UPDATE public.conversations c SET followup_claimed_for=c.last_client_message_at FROM due WHERE c.id=due.id RETURNING c.id,c.phone,c.last_client_message_at
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'phone',phone,'client_at',last_client_message_at)),'[]'::jsonb) INTO jobs FROM claimed;
 RETURN jsonb_build_object('jobs',jobs,'settings',jsonb_build_object('whatsapp_provider',s.whatsapp_provider,'evolution_url',s.evolution_url,'evolution_api_key',s.evolution_api_key,'evolution_instance',s.evolution_instance,'ycloud_api_key',s.ycloud_api_key,'ycloud_from',s.ycloud_from));
END $fn$;
REVOKE ALL ON FUNCTION public.webhook_claim_followups(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_claim_followups(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.webhook_followup_current(_token text,_conversation_id uuid,_client_at timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s public.settings;
BEGIN
 SELECT * INTO s FROM public.settings WHERE id=1;
 IF _token IS NULL OR length(_token)<16 OR _token<>s.webhook_token THEN RAISE EXCEPTION 'invalid token' USING errcode='28000'; END IF;
 RETURN s.auto_reply AND s.followup_enabled AND EXISTS(SELECT 1 FROM public.conversations WHERE id=_conversation_id AND last_client_message_at=_client_at AND company IN ('association','events') AND NOT ai_paused AND last_client_message_at > now()-make_interval(mins=>s.conversation_timeout_minutes));
END $fn$;
REVOKE ALL ON FUNCTION public.webhook_followup_current(text,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_followup_current(text,uuid,timestamptz) TO anon,authenticated;