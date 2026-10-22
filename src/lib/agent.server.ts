// Server-only helpers: knowledge ranking, AI call and Evolution API send.
export type AgentSettings = {
  agent_name: string;
  system_prompt: string;
  evolution_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  ai_provider: string;
  ai_base_url: string;
  ai_api_key: string;
  ai_model: string;
};

export type KnowledgeDoc = { title: string; content: string };
export type HistoryItem = { direction: "in" | "out"; body: string };

const STOP = new Set(
  "a o e de da do das dos em um uma para por com que se na no nas nos os as é ao à eu voce você me meu minha qual quais como quando onde the and of to in is".split(
    " ",
  ),
);

function tokens(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function rankKnowledge(docs: KnowledgeDoc[], query: string, maxChars = 6000): string {
  const chunks: { title: string; text: string; score: number }[] = [];
  for (const d of docs) {
    const parts = d.content.split(/\n{2,}/);
    let buf = "";
    const push = () => {
      if (buf.trim()) chunks.push({ title: d.title, text: buf.trim(), score: 0 });
      buf = "";
    };
    for (const p of parts) {
      if ((buf + "\n\n" + p).length > 900) push();
      buf += (buf ? "\n\n" : "") + p.slice(0, 1800);
    }
    push();
  }
  if (!chunks.length) return "";
  const q = new Set(tokens(query));
  for (const c of chunks) {
    const t = tokens(c.title + " " + c.text);
    let s = 0;
    for (const w of t) if (q.has(w)) s++;
    c.score = s / Math.sqrt(t.length + 5);
  }
  chunks.sort((a, b) => b.score - a.score);
  let out = "";
  for (const c of chunks) {
    const piece = `### ${c.title}\n${c.text}\n\n`;
    if (out.length + piece.length > maxChars) break;
    out += piece;
  }
  return out;
}

export async function callAI(
  s: AgentSettings,
  knowledge: string,
  history: HistoryItem[],
): Promise<string> {
  let url: string;
  let headers: Record<string, string>;
  let model: string;
  if (s.ai_provider === "lovable") {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("IA integrada indisponível neste servidor (LOVABLE_API_KEY ausente). Use OpenAI/compatível.");
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers = { Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" };
    model = "google/gemini-3-flash-preview";
  } else {
    if (!s.ai_api_key) throw new Error("Chave da IA não configurada");
    url = s.ai_base_url.replace(/\/+$/, "") + "/chat/completions";
    headers = { Authorization: `Bearer ${s.ai_api_key}` };
    model = s.ai_model || "gpt-4o-mini";
  }
  const system =
    `Seu nome é ${s.agent_name}. ${s.system_prompt}\n\n` +
    `Você está respondendo pelo WhatsApp: seja breve, sem markdown pesado.\n\n` +
    `BASE DE CONHECIMENTO:\n${knowledge || "(vazia)"}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.direction === "in" ? "user" : "assistant", content: h.body })),
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`IA respondeu ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const reply = json?.choices?.[0]?.message?.content;
  if (!reply || typeof reply !== "string") throw new Error("A IA não retornou texto");
  return reply.trim();
}

export async function sendEvolution(s: AgentSettings, phone: string, text: string) {
  if (!s.evolution_url || !s.evolution_api_key || !s.evolution_instance)
    throw new Error("Evolution API não configurada");
  const url = `${s.evolution_url.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(s.evolution_instance)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: s.evolution_api_key, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Evolution respondeu ${res.status}: ${body.slice(0, 300)}`);
}

export function publicSupabase() {
  // Lazy import keeps this out of client bundles.
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
  return { url, key };
}
