import { createClient } from '@supabase/supabase-js';
import { publicSupabase, sendWhatsApp, type AgentSettings } from './agent.server';

export async function processFollowups() {
  const token = process.env['WHATSAPP_WEBHOOK_TOKEN'];
  if (!token) throw new Error('Autorização de lembretes indisponível');
  const { url, key } = publicSupabase();
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await sb.rpc('webhook_claim_followups', { _token: token });
  if (error) throw new Error(error.message);
  let sent = 0;
  let failed = 0;
  const body = 'Você precisa de mais alguma ajuda?';
  for (const job of data.jobs ?? []) {
    const current = await sb.rpc('webhook_followup_current', { _token: token, _conversation_id: job.id, _client_at: job.client_at });
    if (current.error || !current.data) continue;
    try {
      await sendWhatsApp(data.settings as AgentSettings, job.phone, body);
      const recorded = await sb.rpc('webhook_record_reply', { _token: token, _conversation_id: job.id, _body: body, _status: 'ok', _error: null });
      if (recorded.error) throw new Error('Não foi possível registrar o lembrete');
      sent++;
    } catch {
      failed++;
      await sb.rpc('webhook_record_reply', { _token: token, _conversation_id: job.id, _body: body, _status: 'failed', _error: 'Não foi possível enviar ou registrar o lembrete' });
    }
  }
  return { sent, failed };
}