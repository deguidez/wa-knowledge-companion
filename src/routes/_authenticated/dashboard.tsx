import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { sendManual } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { companyName } from '@/lib/company-flow';
import { pageHead } from '@/lib/page-head';

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead('Conversas', 'Histórico e empresa selecionada no atendimento WhatsApp Pace 3.'),
  component: Conversations,
});

function Conversations() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const send = useServerFn(sendManual);

  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const { data: msgs } = useQuery({
    queryKey: ["messages", selected],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const current = convs?.find((c) => c.id === selected);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title="Conversas" subtitle="Mensagens recebidas e respostas do agente em tempo real." />
      <div className="flex min-h-0 flex-1">
        <div className="w-80 shrink-0 overflow-y-auto border-r max-md:w-40">
          {!convs?.length && <p className="p-6 text-sm text-muted-foreground">Nenhuma conversa ainda. Configure o webhook em Chaves de API.</p>}
          {convs?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn("block w-full border-b px-4 py-3 text-left transition-colors hover:bg-accent", selected === c.id && "bg-accent")}
            >
              <p className="truncate font-medium">{c.name || c.phone}</p>
              <p className="truncate text-xs text-primary">{companyName(c.company)}</p>
              <p className="truncate text-xs text-muted-foreground">
                +{c.phone} · {new Date(c.last_message_at).toLocaleString("pt-BR")}
              </p>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {!current ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">Selecione uma conversa</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-6 py-3">
                <div>
                  <p className="font-semibold">{current.name || current.phone}</p>
                  <p className="text-xs text-muted-foreground">+{current.phone}</p>
                  <p className="text-xs text-primary">{companyName(current.company)}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  IA ativa
                  <Switch
                    checked={!current.ai_paused}
                    onCheckedChange={async (v) => {
                      await supabase.from("conversations").update({ ai_paused: !v }).eq("id", current.id);
                      qc.invalidateQueries({ queryKey: ["conversations"] });
                    }}
                  />
                </label>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-6">
                {msgs?.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                        m.direction === "out" ? "rounded-tr-sm bg-bubble-out text-bubble-out-foreground" : "rounded-tl-sm bg-bubble-in",
                        m.status === "failed" && "border border-destructive",
                      )}
                    >
                      {m.body || <em className="opacity-70">sem resposta</em>}
                      {m.error && <p className="mt-1 text-xs text-destructive">{m.error}</p>}
                      <p className="mt-1 text-right text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2 border-t p-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  try {
                    await send({ data: { conversationId: current.id, text: draft } });
                    setDraft("");
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                }}
              >
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Responder manualmente…" />
                <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
