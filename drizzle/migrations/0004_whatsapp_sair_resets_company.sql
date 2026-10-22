DO $migration$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.webhook_ingest(text,text,text,text,text,jsonb)'::regprocedure);
 IF position('''trocar empresa''' in definition) = 0 THEN RAISE EXCEPTION 'Expected reset commands not found'; END IF;
 definition := replace(definition, '''trocar empresa'')', '''trocar empresa'', ''sair'')');
 EXECUTE definition;
END
$migration$;