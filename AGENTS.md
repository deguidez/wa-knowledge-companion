<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- App is self-hosted on a Node VPS (build with `NITRO_PRESET=node-server`); never depend on the service-role key — it is unavailable outside Lovable.
- The public webhook writes through token-checked SECURITY DEFINER RPCs (`webhook_ingest`, `webhook_record_reply`) using the publishable key, so it works on any host.
- Single admin: first signup becomes admin via trigger; all tables are admin-only through `has_role` RLS.
- File text extraction (PDF/DOCX) runs in the browser; server only fetches URLs.
- WhatsApp provider (Evolution or YCloud) is chosen in settings; one webhook route detects either payload format and `sendWhatsApp` dispatches.
- AI calls use OpenAI-compatible `/chat/completions` so any provider key works; built-in AI needs `LOVABLE_API_KEY` in the env.
- Company routing is stored in settings.routing_flow; token-checked ingest RPC selects the company and filters knowledge/history by that company and selection timestamp, preventing cross-company context. Unassigned legacy knowledge is excluded until classified.
