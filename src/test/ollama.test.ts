import { afterEach, expect, it, vi } from 'vitest';
import { callAI, type AgentSettings } from '@/lib/agent.server';

const settings: AgentSettings = {
  agent_name: 'Atendimento', system_prompt: '', ai_provider: 'ollama',
  ai_base_url: 'http://127.0.0.1:11434/v1', ai_api_key: '', ai_model: 'llama3.2:3b',
  evolution_url: '', evolution_api_key: '', evolution_instance: '',
};
afterEach(() => vi.unstubAllGlobals());
it('calls local Ollama without OpenAI credentials or gateway credits', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta local' } }] })));
  vi.stubGlobal('fetch', fetchMock);
  expect(await callAI(settings, '', [{ direction: 'in', body: 'Olá' }])).toBe('Resposta local');
  expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:11434/v1/chat/completions');
  expect(fetchMock.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization');
  expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body).model).toBe('llama3.2:3b');
});
it('rejects a public Ollama host', async () => {
  await expect(callAI({ ...settings, ai_base_url: 'https://example.com/v1' }, '', [])).rejects.toThrow('endereço local');
});