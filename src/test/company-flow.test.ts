import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, type AgentSettings } from '@/lib/agent.server';
import { menuText, type CompanyFlow } from '@/lib/company-flow';

const flow: CompanyFlow = {
  greeting: 'Olá!', menu_title: 'Escolha uma opção:', other_message: 'Atendente',
  association: { label: 'Associação Pace 3', welcome: 'Associação', instructions: 'Somente associação' },
  events: { label: 'Pace 3 Eventos Esportivos', welcome: 'Eventos', instructions: 'Somente eventos' },
};
afterEach(() => vi.unstubAllGlobals());
describe('Company separation', () => {
  for (const company of ['association', 'events'] as const) {
    it(`uses only the selected ${company} context for AI`, async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta' } }] })));
      vi.stubGlobal('fetch', fetchMock);
      const settings: AgentSettings = {
        agent_name: 'Atendimento', system_prompt: 'Seja objetivo', company_name: flow[company].label,
        company_instructions: flow[company].instructions, ai_provider: 'custom', ai_base_url: 'https://example.com/v1',
        ai_api_key: 'test-only', ai_model: 'existing-model', evolution_url: '', evolution_api_key: '', evolution_instance: '',
      };
      const knowledge = company === 'association' ? 'ASSOCIATION_ONLY' : 'EVENTS_ONLY';
      await callAI(settings, knowledge, [{ direction: 'in', body: 'Qual a informação?' }]);
      const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
      expect(payload.messages[0].content).toContain(`EMPRESA DESTE ATENDIMENTO: ${flow[company].label}`);
      expect(payload.messages[0].content).toContain(knowledge);
      expect(payload.messages[0].content).not.toContain(company === 'association' ? 'EVENTS_ONLY' : 'ASSOCIATION_ONLY');
      expect(payload.model).toBe('existing-model');
    });
  }
});