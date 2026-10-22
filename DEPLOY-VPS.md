# Publicar na VPS (aaPanel) — gpt.evenon.com.br

## 1. DNS
No seu provedor de domínio, crie um registro **A**: `gpt` → IP da VPS.

## 2. Instalar Node.js
aaPanel → **App Store** → instale **Node.js version manager** e ative Node **22**. Instale também **PM2 Manager**.

## 3. Baixar o código
No Lovable, conecte o GitHub (botão GitHub no topo) e, na VPS:
```bash
cd /www/wwwroot
git clone https://github.com/SEU_USUARIO/SEU_REPO.git gpt.evenon.com.br
cd gpt.evenon.com.br
```

## 4. Variáveis de ambiente
Crie o arquivo `.env` na pasta (os valores ficam no `.env` do repositório):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
SUPABASE_URL=...            # mesmo valor de VITE_SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=...# mesmo valor de VITE_SUPABASE_PUBLISHABLE_KEY
```

## 5. Build para Node
```bash
npm install
NITRO_PRESET=node-server npm run build
```

## 6. Iniciar com PM2
```bash
PORT=3000 pm2 start .output/server/index.mjs --name evenon-gpt
pm2 save && pm2 startup
```

## 7. Site + SSL no aaPanel
- **Website → Add site** → domínio `gpt.evenon.com.br` (PHP: estático).
- Na configuração do site → **Reverse proxy** → destino `http://127.0.0.1:3000`.
- **SSL** → Let's Encrypt → ative **Force HTTPS**.

## 8. Evolution API
No painel (Chaves de API) copie o webhook:
`https://gpt.evenon.com.br/api/public/evolution/webhook?token=...`
Na Evolution: Webhook → habilitado, cole a URL, evento **MESSAGES_UPSERT**.

## Atualizar
```bash
git pull && npm install && NITRO_PRESET=node-server npm run build && pm2 restart evenon-gpt
```

## 9. IA própria com Ollama (sem créditos OpenAI)

Para a VPS informada de **16 GB de RAM e 4 CPUs**, comece testando `llama3.2:3b`. A capacidade real depende da RAM livre, CPU e outros serviços; sem GPU, respostas podem demorar e não há garantia para vários clientes simultâneos. Compare respostas em português e informações das duas empresas antes de ativar atendimento automático.

No terminal da VPS Linux, instale pelo instalador oficial (revise o script antes de executar):
```bash
curl -fsSL https://ollama.com/install.sh -o /tmp/install-ollama.sh
less /tmp/install-ollama.sh
sh /tmp/install-ollama.sh
ollama pull llama3.2:3b
```

Mantenha Ollama acessível **somente na própria VPS**. Não abra a porta 11434 no firewall nem crie proxy público para ela. Na instalação como serviço systemd:
```bash
sudo systemctl edit ollama.service
```
Adicione:
```ini
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
```
Depois:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
curl http://127.0.0.1:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"Responda em português: olá!"}]}'
```

No painel hospedado na VPS, **Chaves de API → Inteligência artificial**:
- Provedor: **Ollama · IA na sua VPS**.
- URL base: `http://127.0.0.1:11434/v1`.
- Modelo: `llama3.2:3b`.
- Não precisa de chave de IA. Salve e teste cada empresa na tela Agente.

O endereço local aponta para o servidor que executa o painel: esta configuração não alcança sua VPS a partir da prévia Lovable. Não alteramos a escolha atual de IA automaticamente.

As respostas locais não usam OpenAI ou Lovable AI e não têm cobrança por token dessas plataformas. **VPS, WhatsApp/YCloud/Meta e Lovable Cloud (login, dados e arquivos) continuam sendo serviços separados**; isto não migra o banco ou login para sua VPS. O menu inicial e mensagens das opções são determinísticos e já dispensam chamadas de IA.

Documentação oficial: https://docs.ollama.com/linux · https://docs.ollama.com/api/openai-compatibility · https://docs.ollama.com/faq · https://ollama.com/library/llama3.2:3b
