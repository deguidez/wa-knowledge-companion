-- Integration regression: execute against the connected database, then remove
-- only the fixture conversation/messages/events named whatsapp-sair-regression.
WITH selected AS MATERIALIZED (
 SELECT public.webhook_ingest(
  (SELECT webhook_token FROM public.settings WHERE id = 1),
  'whatsapp-sair-regression', 'Regression', '2',
  'whatsapp-sair-regression-select', '{"regression":"whatsapp-sair-regression"}'::jsonb
 ) AS result
), reset AS MATERIALIZED (
 SELECT public.webhook_ingest(
  (SELECT webhook_token FROM public.settings WHERE id = 1),
  'whatsapp-sair-regression', 'Regression', ' SAIR ',
  'whatsapp-sair-regression-reset', '{"regression":"whatsapp-sair-regression"}'::jsonb
 ) AS result FROM selected WHERE result->>'company' = 'events'
)
SELECT
 result->>'company' IS NULL AS company_cleared,
 result->>'direct_reply' LIKE '%1 - Associação Pace 3%2 - Pace 3 Eventos Esportivos%' AS menu_returned,
 result->'history' = '[]'::jsonb AS previous_history_excluded,
 result->'knowledge' = '[]'::jsonb AS previous_knowledge_excluded
FROM reset;