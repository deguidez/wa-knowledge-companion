import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSettings, settingsQuery, type Settings } from "@/lib/settings";
import { testEvolution } from "@/lib/admin.functions";
import { pageHead } from '@/lib/page-head';

export const Route = createFileRoute("/_authenticated/chaves")({
  head: () => pageHead('Chaves de API', 'Conexões WhatsApp e IA do atendimento Evenon GPT.'),
  component: KeysPage,
});

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function KeysPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);
  const test = useServerFn(testEvolution);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhook = `${origin}/api/public/evolution/webhook?token=${form.webhook_token ?? ""}`;

  async function save(extra?: Partial<Settings>) {
    setSaving(true);
    try {
      await saveSettings({
        whatsapp_provider: form.whatsapp_provider ?? "evolution",
        ycloud_api_key: (form.ycloud_api_key ?? "").trim(),
        ycloud_from: (form.ycloud_from ?? "").replace(/[^\d+]/g, ""),
        evolution_url: (form.evolution_url ?? "").trim(),
        evolution_api_key: (form.evolution_api_key ?? "").trim(),
        evolution_instance: (form.evolution_instance ?? "").trim(),
        ai_provider: form.ai_provider ?? "lovable",
        ai_base_url: (form.ai_base_url ?? "").trim(),
        ai_api_key: (form.ai_api_key ?? "").trim(),
        ai_model: (form.ai_model ?? "").trim(),
        ...extra,
      });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Salvo");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const isY = form.whatsapp_provider === "ycloud";
  return (
    <div>
      <PageHeader title="Chaves de API" subtitle="Conecte o WhatsApp e escolha a IA que vai responder." />
      <div className="grid gap-6 p-8 max-md:p-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">WhatsApp</h2>
          <Field label="Provedor">
            <Select value={form.whatsapp_provider ?? "evolution"} onValueChange={(v) => setForm((f) => ({ ...f, whatsapp_provider: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="evolution">Evolution API</SelectItem>
                <SelectItem value="ycloud">YCloud (API oficial)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isY ? (
            <>
              <Field label="API Key da YCloud" hint="YCloud → Developers → API Keys">
                <Input type="password" value={form.ycloud_api_key ?? ""} onChange={set("ycloud_api_key")} />
              </Field>
              <Field label="Número do WhatsApp (remetente)" hint="Com DDI, ex.: +5511999999999">
                <Input value={form.ycloud_from ?? ""} onChange={set("ycloud_from")} placeholder="+55..." />
              </Field>
            </>
          ) : (
            <>
              <Field label="URL do servidor" hint="Ex.: https://evolution.seudominio.com.br">
                <Input value={form.evolution_url ?? ""} onChange={set("evolution_url")} placeholder="https://..." />
              </Field>
              <Field label="API Key">
                <Input type="password" value={form.evolution_api_key ?? ""} onChange={set("evolution_api_key")} />
              </Field>
              <Field label="Nome da instância">
                <Input value={form.evolution_instance ?? ""} onChange={set("evolution_instance")} />
              </Field>
            </>
          )}
          <div className="flex gap-2">
            <Button onClick={() => save()} disabled={saving}>Salvar</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const r = await test();
                  toast.success(`Conexão: ${r.state}`);
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Testar conexão
            </Button>
          </div>
          <div className="space-y-2 border-t pt-4">
            <Label>
              {isY
                ? "Webhook (YCloud → Developers → Webhooks, evento whatsapp.inbound_message.received)"
                : "Webhook (cole na Evolution, evento MESSAGES_UPSERT)"}
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={webhook} className="font-mono text-xs" />
              <Button size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(webhook); toast.success("Copiado"); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                title="Gerar novo token"
                onClick={() => {
                  const arr = crypto.getRandomValues(new Uint8Array(24));
                  const t = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
                  save({ webhook_token: t });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Depois de publicar na VPS, use o endereço com https://gpt.evenon.com.br.</p>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Inteligência artificial</h2>
          <Field label="Provedor">
            <Select value={form.ai_provider ?? "lovable"} onValueChange={(v) => setForm((f) => ({ ...f, ai_provider: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">IA integrada (sem chave)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="custom">Outro compatível (OpenRouter, Groq, DeepSeek…)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.ai_provider === "lovable" ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Usa a IA integrada, cobrada nos créditos do workspace. Na VPS ela só funciona se a variável LOVABLE_API_KEY estiver definida; caso contrário, escolha OpenAI.
            </p>
          ) : (
            <>
              <Field label="URL base" hint="OpenAI: https://api.openai.com/v1">
                <Input value={form.ai_base_url ?? ""} onChange={set("ai_base_url")} />
              </Field>
              <Field label="API Key">
                <Input type="password" value={form.ai_api_key ?? ""} onChange={set("ai_api_key")} placeholder="sk-..." />
              </Field>
              <Field label="Modelo" hint="Ex.: gpt-4o-mini">
                <Input value={form.ai_model ?? ""} onChange={set("ai_model")} />
              </Field>
            </>
          )}
          <Button onClick={() => save()} disabled={saving}>Salvar</Button>
        </section>
      </div>
    </div>
  );
}
