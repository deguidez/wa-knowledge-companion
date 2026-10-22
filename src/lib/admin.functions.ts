import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, sendWhatsApp, type AgentSettings } from "@/lib/agent.server";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Acesso negado");
}

async function loadSettings(supabase: any): Promise<AgentSettings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data as AgentSettings;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export const importUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ url: z.string().url().max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const u = new URL(data.url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("URL inválida");
    const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (WhatsAppAgent)" } });
    if (!res.ok) throw new Error(`O site respondeu ${res.status}`);
    const html = (await res.text()).slice(0, 3_000_000);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || u.hostname;
    const content = htmlToText(html).slice(0, 300_000);
    if (!content) throw new Error("Nenhum texto encontrado na página");
    const { error } = await context.supabase
      .from("knowledge_items")
      .insert({ kind: "url", title, source: data.url, content });
    if (error) throw new Error(error.message);
    return { title, chars: content.length };
  });

export const testAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ question: z.string().min(1).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const s = await loadSettings(context.supabase);
    const { data: kb } = await context.supabase.from("knowledge_items").select("title, content");
    const { rankKnowledge } = await import("@/lib/agent.server");
    const text = rankKnowledge((kb ?? []) as any, data.question);
    const reply = await callAI(s, text, [{ direction: "in", body: data.question }]);
    return { reply };
  });

export const sendManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ conversationId: z.string().uuid(), text: z.string().min(1).max(4000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const s = await loadSettings(context.supabase);
    const { data: conv, error } = await context.supabase
      .from("conversations")
      .select("phone")
      .eq("id", data.conversationId)
      .single();
    if (error) throw new Error(error.message);
    await sendWhatsApp(s, conv.phone, data.text);
    await context.supabase
      .from("messages")
      .insert({ conversation_id: data.conversationId, direction: "out", body: data.text });
    await context.supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    return { ok: true };
  });

export const testEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const s = await loadSettings(context.supabase);
    if (s.whatsapp_provider === "ycloud") {
      if (!s.ycloud_api_key) throw new Error("Preencha a API Key da YCloud");
      const r = await fetch("https://api.ycloud.com/v2/whatsapp/phoneNumbers?limit=10", { headers: { "X-API-Key": s.ycloud_api_key } });
      const b = await r.text();
      if (!r.ok) throw new Error(`YCloud respondeu ${r.status}: ${b.slice(0, 200)}`);
      let n = 0;
      try { n = JSON.parse(b)?.items?.length ?? 0; } catch {}
      return { state: `YCloud ok (${n} número(s))` };
    }
    if (!s.evolution_url || !s.evolution_api_key || !s.evolution_instance)
      throw new Error("Preencha URL, chave e instância");
    const res = await fetch(
      `${s.evolution_url.replace(/\/+$/, "")}/instance/connectionState/${encodeURIComponent(s.evolution_instance)}`,
      { headers: { apikey: s.evolution_api_key } },
    );
    const body = await res.text();
    if (!res.ok) throw new Error(`Evolution respondeu ${res.status}: ${body.slice(0, 200)}`);
    let state = "desconhecido";
    try {
      state = JSON.parse(body)?.instance?.state ?? state;
    } catch {}
    return { state };
  });
