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
