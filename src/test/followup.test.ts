import { afterEach, expect, it, vi } from 'vitest';
import { processFollowups } from '@/lib/followup.server';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('sends once when current and skips a customer who already replied', async () => {
  vi.stubEnv('WHATSAPP_WEBHOOK_TOKEN', 'test-webhook-token');
  vi.stubEnv('SUPABASE_URL', 'https://database.example');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  const responses = [
    { jobs: [{ id: 'first', phone: '100', client_at: 'now' }, { id: 'second', phone: '200', client_at: 'then' }], settings: { evolution_url: 'https://provider.example', evolution_api_key: 'test', evolution_instance: 'test' } },
    true, {}, null, false,
  ];
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(responses.shift()), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await processFollowups()).toEqual({ sent: 1, failed: 0 });
  const sends = fetchMock.mock.calls.filter(call => String(call[0]).includes('/message/sendText/'));
  expect(sends).toHaveLength(1);
  expect(JSON.parse(sends[0]?.[1].body).number).toBe('100');
});