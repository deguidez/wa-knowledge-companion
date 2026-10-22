#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
trap 'printf "\nInstalação interrompida na linha %s; corrija o erro acima antes de repetir.\n" "$LINENO" >&2' ERR

check_only=false
if [[ "${1:-}" == '--check' ]]; then check_only=true; shift; fi
[[ $# -le 1 ]] || fail 'Uso: bash instalar-vps.sh [--check] /pasta/do/projeto'
app_dir="${1:-$PWD}"
[[ -d "$app_dir" ]] || fail 'Pasta do projeto não encontrada.'
app_dir="$(realpath "$app_dir")"
[[ -f "$app_dir/package.json" && -f "$app_dir/vite.config.ts" && -f "$app_dir/scripts/ecosystem.config.cjs" ]] || fail 'Envie o projeto completo e atualizado para essa pasta antes de instalar.'
[[ -f "$app_dir/.env" ]] || fail 'Falta o arquivo .env do projeto. Não envie seu conteúdo no chat.'
for cmd in node npm curl systemctl; do
  command -v "$cmd" >/dev/null || fail "Falta $cmd. No aaPanel, ative Node 22 no terminal; este instalador exige Linux com systemd."
done
node -e 'if (+process.versions.node.split(".")[0] < 22) process.exit(1)' || fail 'Ative Node.js 22 ou superior no terminal do aaPanel.'
node --env-file="$app_dir/.env" -e '
  const keys = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID"];
  if (keys.some(k => !process.env[k] || process.env[k].includes("..."))) process.exit(1);
' || fail 'As configurações públicas do Lovable Cloud estão ausentes ou incompletas no .env. Use o arquivo original do projeto.'
[[ -d /run/systemd/system ]] || fail 'Este servidor precisa executar systemd para manter os serviços ligados.'
printf '\nVerificações do projeto concluídas. Aplicativo: %s\n' "$app_dir"
if "$check_only"; then
  printf 'Nada foi instalado ou alterado. Requer root para a instalação completa.\n'
  exit 0
fi
[[ "$EUID" -eq 0 ]] || fail 'Execute como root no terminal do aaPanel.'
printf '\nVai instalar dependências, compilar o projeto, criar/atualizar o serviço evenon-gpt e configurar Ollama local.\n'
printf 'Não altera sites, DNS, firewall, SSL ou dados de atendimento. Outros serviços PM2 não serão reiniciados.\n'
read -r -p 'Para continuar, digite INSTALAR: ' consent
[[ "$consent" == 'INSTALAR' ]] || fail 'Cancelado sem alterações.'

cd "$app_dir"
chmod 600 .env
npm install
NITRO_PRESET=node-server npm run build
[[ -f .output/server/index.mjs ]] || fail 'A compilação não gerou o servidor Node esperado. Não foi iniciado nenhum aplicativo.'
command -v pm2 >/dev/null || npm install -g pm2
pm2 startOrReload scripts/ecosystem.config.cjs --only evenon-gpt --update-env
pm2 save
pm2 startup systemd -u root --hp /root

if ! command -v ollama >/dev/null; then
  official_script="$(mktemp /tmp/ollama-install.XXXXXX.sh)"
  curl --proto '=https' --tlsv1.2 -fsSL https://ollama.com/install.sh -o "$official_script"
  printf '\nInstalador oficial do Ollama baixado: %s\n' "$official_script"
  printf 'Revise esse arquivo em outro terminal antes de autorizar sua execução.\n'
  read -r -p 'Depois da revisão, digite OLLAMA para instalar: ' consent
  [[ "$consent" == 'OLLAMA' ]] || fail "Aplicativo iniciado; Ollama não instalado. Arquivo para revisão: $official_script"
  sh "$official_script"
  rm -f "$official_script"
fi
systemctl cat ollama.service >/dev/null || fail 'Ollama está instalado, mas falta seu serviço systemd. Consulte DEPLOY-VPS.md.'
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/evenon-local.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
EOF
systemctl daemon-reload
systemctl enable ollama.service
systemctl restart ollama.service
ollama_ready=false
for attempt in {1..30}; do
  if curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null; then ollama_ready=true; break; fi
  sleep 2
done
"$ollama_ready" || fail 'Ollama não iniciou. Confira: systemctl status ollama'
OLLAMA_HOST=127.0.0.1:11434 ollama pull llama3.2:3b
curl -fsS --max-time 600 http://127.0.0.1:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"Responda em português: olá!"}],"max_tokens":40,"stream":false}' \
  | node -e 'let s=""; process.stdin.on("data", d=>s+=d); process.stdin.on("end",()=>{try {const r=JSON.parse(s); if (!r.choices?.[0]?.message?.content) process.exit(1); console.log("Ollama respondeu ao teste local.")} catch {process.exit(1)}})'
app_ready=false
for attempt in {1..30}; do
  if curl -fsS --max-time 10 http://127.0.0.1:3000/auth >/dev/null; then app_ready=true; break; fi
  sleep 2
done
"$app_ready" || fail 'O painel não respondeu. Confira: pm2 logs evenon-gpt --lines 30 (não compartilhe chaves ou dados pessoais).'
printf '\nAplicativo e Ollama responderam aos testes locais.\n'
printf 'Agora configure no aaPanel: gpt.evenon.com.br → proxy http://127.0.0.1:3000 → SSL e HTTPS.\n'
printf 'No painel: Chaves de API → Ollama → http://127.0.0.1:11434/v1 → llama3.2:3b → Salvar.\n'
printf 'Teste as duas empresas antes de ativar respostas automáticas.\n'
printf 'Não abra as portas 3000 e 11434. Configure o webhook Evolution ou YCloud com o domínio HTTPS.\n'
printf 'Login, dados e arquivos permanecem no Lovable Cloud.\n'