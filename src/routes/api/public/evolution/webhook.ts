import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  callAI,
  publicSupabase,
  rankKnowledge,
  sendEvolution,
  type AgentSettings,
  type HistoryItem,
  type KnowledgeDoc,
} from "@/lib/agent.server";

const Payload = z.object({
  event: z.string().optional(),
  data: z
    .object({
      key: z.object({ remoteJid: z.string(), fromMe: z.boolean().optional(), id: z.string() }),
      pushName: z.string().optional().nullable(),
      message: z.record(z.any()).optional().nullable(),
    })
    .passthrough(),
});

function extractText(m: Record<string, any> | null | undefined): string | null {
  if (!m) return null;
  const msg = m as any;
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.documentMessage?.caption ??
    null
  );
}

export const Route = createFileRoute("/api/public/evolution/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (token.length < 16) return new Response("unauthorized", { status: 401 });

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const parsed = Payload.safeParse(raw);
        const evt = (raw as any)?.event?.toString().toLowerCase().replace("_", ".");
        if (!parsed.success || (evt && evt !== "messages.upsert")) return Response.json({ ignored: true });

        const { key, pushName, message } = parsed.data.data;
        if (key.fromMe || !key.remoteJid.endsWith("@s.whatsapp.net")) return Response.json({ ignored: true });
        const text = extractText(message);
        if (!text?.trim()) return Response.json({ ignored: true });
        const phone = key.remoteJid.split("@")[0] ?? "";

        const { url, key: pk } = publicSupabase();
        const sb = createClient<Database>(url, pk, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (pk.startsWith("sb_") && h.get("Authorization") === `Bearer ${pk}`) h.delete("Authorization");
              h.set("apikey", pk);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data, error } = await sb.rpc("webhook_ingest", {
          _token: token,
          _phone: phone,
          _name: pushName ?? "",
          _body: text.slice(0, 8000),
          _external_id: key.id,
          _payload: raw as any,
        });
        if (error) {
          if (error.code === "28000") return new Response("unauthorized", { status: 401 });
          console.error("ingest failed", error);
          return new Response("db error", { status: 500 });
        }
        const r = data as any;
        if (r.duplicate || !r.reply) return Response.json({ ok: true });

        const settings = r.settings as AgentSettings;
        const history = r.history as HistoryItem[];
        let reply = "";
        try {
          const kb = rankKnowledge(r.knowledge as KnowledgeDoc[], history.filter((h) => h.direction === "in").slice(-3).map((h) => h.body).join(" "));
          reply = await callAI(settings, kb, history);
          await sendEvolution(settings, phone, reply);
          await sb.rpc("webhook_record_reply", { _token: token, _conversation_id: r.conversation_id, _body: reply, _status: "ok", _error: null as any });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("reply failed", msg);
          await sb.rpc("webhook_record_reply", { _token: token, _conversation_id: r.conversation_id, _body: reply, _status: "failed", _error: msg });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
