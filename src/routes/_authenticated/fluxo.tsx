import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowDown, GitBranch, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { companies, menuText, readFlow, type Company, type CompanyFlow } from '@/lib/company-flow';
import { settingsQuery, saveSettings } from '@/lib/settings';
import { pageHead } from '@/lib/page-head';
import type { Json } from '@/integrations/supabase/types';

export const Route = createFileRoute('/_authenticated/fluxo')({
  head: () => pageHead('Fluxo de atendimento', 'Atendimento separado para Associação Pace 3 e Pace 3 Eventos Esportivos.'),
  component: FlowPage,
});

function FlowPage() {
  const { data, error } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const [flow, setFlow] = useState<CompanyFlow>();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string>('menu');
  useEffect(() => { if (data) setFlow(readFlow(data.routing_flow)); }, [data]);
  if (!flow) return <div className="p-8 text-muted-foreground">{error ? 'Não foi possível carregar o fluxo.' : 'Carregando…'}</div>;
  const edit = (key: 'greeting' | 'menu_title' | 'other_message', value: string) => setFlow({ ...flow, [key]: value });
  const branch = (company: Company, key: 'label' | 'welcome' | 'instructions', value: string) => setFlow({ ...flow, [company]: { ...flow[company], [key]: value } });
  const valid = [flow.greeting, flow.menu_title, flow.other_message, ...companies.flatMap(c => Object.values(flow[c]))].every(s => s.trim().length > 0);
  return <div>
    <PageHeader title="Fluxo de atendimento" subtitle="Pace 3 Eventos Esportivos · Associação Pace 3" />
    <div className="grid gap-8 p-8 max-md:p-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form className="min-w-0 space-y-6" onSubmit={async e => {
        e.preventDefault(); if (!valid) return;
        setSaving(true);
        try { await saveSettings({ routing_flow: flow as unknown as Json }); await qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Fluxo salvo'); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar'); } finally { setSaving(false); }
      }}>
        <div className="flex items-center gap-2 text-primary"><GitBranch className="h-5 w-5" /><h2 className="font-semibold">Início do atendimento</h2></div>
        <div className="space-y-2"><Label htmlFor="greeting">Mensagem inicial</Label><Textarea id="greeting" rows={3} value={flow.greeting} onChange={e => edit('greeting', e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="menu-title">Título das opções</Label><Input id="menu-title" value={flow.menu_title} onChange={e => edit('menu_title', e.target.value)} required /></div>
        <ArrowDown className="mx-auto h-5 w-5 text-muted-foreground" />
        <div className="grid gap-4 lg:grid-cols-2">{companies.map((c, i) => <section key={c} className="min-w-0 space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold text-primary">Opção {i + 1}</h2>
          <div className="space-y-2"><Label htmlFor={`${c}-label`}>Empresa</Label><Input id={`${c}-label`} value={flow[c].label} onChange={e => branch(c, 'label', e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor={`${c}-welcome`}>Mensagem após a escolha</Label><Textarea id={`${c}-welcome`} rows={3} value={flow[c].welcome} onChange={e => branch(c, 'welcome', e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor={`${c}-instructions`}>Instruções da IA para esta empresa</Label><Textarea id={`${c}-instructions`} rows={5} value={flow[c].instructions} onChange={e => branch(c, 'instructions', e.target.value)} required /></div>
        </section>)}</div>
        <div className="space-y-2 border-t pt-5"><Label htmlFor="other-message">Opção 3 · Outros — mensagem do atendente</Label><Textarea id="other-message" rows={2} value={flow.other_message} onChange={e => edit('other_message', e.target.value)} required /></div>
        <Button type="submit" disabled={saving || !valid}><Save className="h-4 w-4" />{saving ? 'Salvando…' : 'Salvar fluxo'}</Button>
      </form>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-8 xl:self-start">
        <h2 className="font-semibold">Prévia no WhatsApp</h2>
        <div className="whitespace-pre-wrap rounded-lg bg-bubble-in p-4 text-sm">{menuText(flow)}</div>
        <div className="flex gap-2">{['1', '2', '3'].map((n, i) => <Button key={n} variant="secondary" onClick={() => setPreview(['association', 'events', 'other'][i] ?? 'menu')}>{n}</Button>)}<Button variant="ghost" onClick={() => setPreview('menu')}>Menu</Button></div>
        {preview !== 'menu' && <div className="whitespace-pre-wrap rounded-lg bg-bubble-out p-4 text-sm text-bubble-out-foreground">{preview === 'other' ? flow.other_message : flow[preview === 'association' ? 'association' : 'events'].welcome}</div>}
        <p className="border-t pt-4 text-sm text-muted-foreground">Voltar ao início: 0 ou menu</p>
      </aside>
    </div>
  </div>;
}