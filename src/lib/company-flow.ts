import type { Json } from '@/integrations/supabase/types';

export const companies = ['association', 'events'] as const;
export type Company = (typeof companies)[number];
export const companyLabels: Record<Company, string> = {
  association: 'Associação Pace 3', events: 'Pace 3 Eventos Esportivos',
};
export type CompanyBranch = { label: string; welcome: string; instructions: string };
export type CompanyFlow = { greeting: string; menu_title: string; other_message: string; association: CompanyBranch; events: CompanyBranch };
export function readFlow(value: Json | undefined): CompanyFlow {
  const flow = value as unknown as CompanyFlow;
  if (!flow?.association || !flow?.events) throw new Error('Fluxo de atendimento indisponível');
  return flow;
}
export function menuText(flow: CompanyFlow) {
  return `${flow.greeting}\n\n${flow.menu_title}\n1 - ${flow.association.label}\n2 - ${flow.events.label}\n3 - Outros`;
}
export function companyName(company: string | null | undefined) {
  return company === 'association' || company === 'events' ? companyLabels[company] : company === 'other' ? 'Outros' : 'Aguardando escolha';
}