ALTER TABLE public.settings ADD COLUMN conversation_timeout_minutes integer NOT NULL DEFAULT 2;
ALTER TABLE public.conversations ADD COLUMN last_client_message_at timestamptz;
UPDATE public.conversations c SET last_client_message_at = (SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id AND m.direction = 'in');
CREATE OR REPLACE FUNCTION public.validate_conversation_timeout() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
 IF NEW.conversation_timeout_minutes < 1 THEN RAISE EXCEPTION 'O tempo deve ser de pelo menos 1 minuto'; END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER validate_conversation_timeout BEFORE INSERT OR UPDATE OF conversation_timeout_minutes ON public.settings FOR EACH ROW EXECUTE FUNCTION public.validate_conversation_timeout();
DO $migration$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.webhook_ingest(text,text,text,text,text,jsonb)'::regprocedure);
 IF position('choice := lower(trim(_body));' in definition) = 0 THEN RAISE EXCEPTION 'Expected routing entry not found'; END IF;
 definition := replace(definition, 'choice := lower(trim(_body));', 'choice := lower(trim(_body));
 IF conv.company IS NOT NULL AND conv.last_client_message_at IS NOT NULL AND now() >= conv.last_client_message_at + make_interval(mins => s.conversation_timeout_minutes) THEN
  UPDATE public.conversations SET company = NULL, company_selected_at = NULL WHERE id = conv.id;
  conv.company := NULL;
  conv.company_selected_at := NULL;
  UPDATE public.messages SET company = NULL WHERE external_id = _external_id;
  choice := '''';
 END IF;
 UPDATE public.conversations SET last_client_message_at = now() WHERE id = conv.id;');
 EXECUTE definition;
END
$migration$;