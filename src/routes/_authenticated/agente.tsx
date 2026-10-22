import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings, settingsQuery } from "@/lib/settings";
import { testAgent } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/agente")({
  head: () => ({ meta: [{ title: "Agente — Evenon GPT" }] }),
  component: AgentPage,
});

function AgentPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [auto, setAuto] = useState(true);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [testing, setTesting] = useState(false);
  const test = useServerFn(testAgent);

  useEffect(() => {
    if (data) {
      setName(data.agent_name);
      setPrompt(data.system_prompt);
      setAuto(data.auto_reply);
    }
  }, [data]);

  async function save() {
    try {
      await saveSettings({ agent_name: name, system_prompt: prompt, auto_reply: auto });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Agente salvo");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div>
      <PageHeader title="Agente" subtitle="Personalidade e comportamento das respostas." />
      <div className="grid gap-6 p-8 max-md:p-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <div>
              <p className="font-medium">Respostas automáticas</p>
              <p className="text-sm text-muted-foreground">Quando desligado, só registra as mensagens.</p>
            </div>
            <Switch checked={auto} onCheckedChange={setAuto} />
          </div>
          <div className="space-y-2">
            <Label>Nome do agente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Instruções</Label>
            <Textarea rows={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>
          <Button onClick={save}>Salvar</Button>
        </section>
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Testar agente</h2>
          <p className="text-sm text-muted-foreground">Faça uma pergunta como se fosse um cliente (salve antes de testar).</p>
          <Textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qual o horário de atendimento?" />
          <Button
            disabled={testing || !q.trim()}
            onClick={async () => {
              setTesting(true);
              setAnswer("");
              try {
                const r = await test({ data: { question: q } });
                setAnswer(r.reply);
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? "Pensando…" : "Perguntar"}
          </Button>
          {answer && <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-bubble-out p-4 text-sm text-bubble-out-foreground">{answer}</div>}
        </section>
      </div>
    </div>
  );
}
