import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Evenon GPT — Agente de IA para WhatsApp" },
      { name: "description", content: "Atendimento automático no WhatsApp com IA treinada no seu conteúdo." },
      { property: "og:title", content: "Evenon GPT — Agente de IA para WhatsApp" },
      { property: "og:description", content: "Atendimento automático no WhatsApp com IA treinada no seu conteúdo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
