import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  callAI,
  publicSupabase,
  rankKnowledge,
  sendWhatsApp,
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
        let phone = "", text: string | null = null, extId = "", pushName: string | null | undefined = null;
        const y = raw as any;
        if (typeof y?.type === "string" && y.type.startsWith("whatsapp.")) {
          // YCloud
          if (y.type !== "whatsapp.inbound_message.received") return Response.json({ ignored: true });
          const m = y.whatsappInboundMessage;
          if (!m?.from || !m?.id) return Response.json({ ignored: true });
          text = m.text?.body ?? m.image?.caption ?? m.video?.caption ?? m.document?.caption ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
          phone = String(m.from).replace(/\D/g, "");
          extId = "yc:" + m.id;
          pushName = m.customerProfile?.name;
        } else {
          const parsed = Payload.safeParse(raw);
          const evt = y?.event?.toString().toLowerCase().replace("_", ".");
          if (!parsed.success || (evt && evt !== "messages.upsert")) return Response.json({ ignored: true });
          const { key, message } = parsed.data.data;
          if (key.fromMe || !key.remoteJid.endsWith("@s.whatsapp.net")) return Response.json({ ignored: true });
          text = extractText(message);
          phone = key.remoteJid.split("@")[0] ?? "";
          extId = key.id;
          pushName = parsed.data.data.pushName;
        }
        if (!text?.trim() || !phone) return Response.json({ ignored: true });

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
          _external_id: extId,
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
          reply = typeof r.direct_reply === "string" ? r.direct_reply : await callAI(settings, kb, history);
          await sendWhatsApp(settings, phone, reply);
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
