import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Globe, Trash2, Type, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { importUrl } from "@/lib/admin.functions";
import { extractText } from "@/lib/extract";

export const Route = createFileRoute("/_authenticated/conhecimento")({
  head: () => ({ meta: [{ title: "Conhecimento — Evenon GPT" }] }),
  component: KnowledgePage,
});

const icons = { text: Type, url: Globe, pdf: FileText, file: Upload } as const;

function KnowledgePage() {
  const qc = useQueryClient();
  const { data: items } = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_items")
        .select("id, kind, title, source, file_path, created_at, content")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["knowledge"] });
  const doImport = useServerFn(importUrl);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    await run(async () => {
      for (const file of Array.from(files)) {
        const content = (await extractText(file)).trim();
        if (!content) {
          toast.error(`${file.name}: nenhum texto encontrado`);
          continue;
        }
        const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("knowledge").upload(path, file);
        if (up.error) throw up.error;
        const isPdf = file.name.toLowerCase().endsWith(".pdf");
        const { error } = await supabase.from("knowledge_items").insert({
          kind: isPdf ? "pdf" : "file",
          title: file.name,
          file_path: path,
          content: content.slice(0, 300_000),
        });
        if (error) throw error;
        toast.success(`${file.name} adicionado`);
      }
    });
  }

  return (
    <div>
      <PageHeader title="Base de conhecimento" subtitle="Tudo que a IA pode usar para responder seus clientes." />
      <div className="grid gap-6 p-8 max-md:p-4 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rounded-2xl border bg-card p-6">
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">Texto</TabsTrigger>
              <TabsTrigger value="url">Site</TabsTrigger>
              <TabsTrigger value="file">Arquivo</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Preços e horários" />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <Button
                disabled={busy || !title.trim() || !text.trim()}
                onClick={() =>
                  run(async () => {
                    const { error } = await supabase.from("knowledge_items").insert({ kind: "text", title, content: text });
                    if (error) throw error;
                    setTitle("");
                    setText("");
                    toast.success("Texto adicionado");
                  })
                }
              >
                Adicionar texto
              </Button>
            </TabsContent>
            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Endereço do site</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seusite.com.br/servicos" />
              </div>
              <Button
                disabled={busy || !url.trim()}
                onClick={() =>
                  run(async () => {
                    const r = await doImport({ data: { url: url.trim() } });
                    setUrl("");
                    toast.success(`"${r.title}" importado`);
                  })
                }
              >
                {busy ? "Lendo página…" : "Importar página"}
              </Button>
            </TabsContent>
            <TabsContent value="file" className="pt-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors hover:border-primary">
                <Upload className="h-8 w-8 text-primary" />
                <span className="font-medium">{busy ? "Processando…" : "Escolher arquivos"}</span>
                <span className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD, CSV — até 20 MB</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                  disabled={busy}
                  onChange={(e) => {
                    onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-3">
          {!items?.length && <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhum conteúdo ainda.</p>}
          {items?.map((it) => {
            const Icon = icons[it.kind as keyof typeof icons] ?? FileText;
            return (
              <div key={it.id} className="flex items-start gap-4 rounded-2xl border bg-card p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.source ?? it.kind.toUpperCase()} · {it.content.length.toLocaleString("pt-BR")} caracteres
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{it.content.slice(0, 240)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    run(async () => {
                      if (!confirm("Remover este conteúdo?")) return;
                      if (it.file_path) await supabase.storage.from("knowledge").remove([it.file_path]);
                      const { error } = await supabase.from("knowledge_items").delete().eq("id", it.id);
                      if (error) throw error;
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
