# Agente de IA para WhatsApp (Evolution API)

## O que será construído
Um painel com login de administrador onde você:
1. **Login** – acesso só para você (e-mail e senha).
2. **Base de conhecimento** – adiciona conteúdo que a IA usa para responder:
   - Texto livre
   - PDF (o texto é extraído automaticamente)
   - URLs de sites (a página é lida e salva)
   - Arquivos (TXT, MD, CSV, DOCX)
3. **Chaves de API** – tela para salvar:
   - Evolution API: URL do servidor, chave e nome da instância
   - Provedor de IA: IA integrada, OpenAI ou outro compatível (URL + chave + modelo)
4. **Configurações do agente** – nome, personalidade/instruções, ligar/desligar respostas automáticas.
5. **Conversas** – lista de contatos e histórico de mensagens recebidas e respondidas.
6. **Recebimento automático** – um endereço (webhook) que você cola na Evolution API; cada mensagem recebida é respondida pela IA usando sua base de conhecimento.

## Visual
Painel escuro, moderno, com destaque em verde (identidade WhatsApp), menu lateral.

## Hospedagem na sua VPS (aaPanel)
- O app roda na VPS com Node.js (aaPanel → Site Node.js), domínio **gpt.evenon.com.br** com SSL.
- Login, banco de dados e arquivos ficam no Lovable Cloud (funciona de qualquer servidor, sem você manter banco).
- Entrego um guia passo a passo: baixar o código (GitHub), `npm install`, `npm run build`, iniciar com PM2, configurar proxy reverso e SSL no aaPanel.
- Webhook final para a Evolution API: `https://gpt.evenon.com.br/api/public/evolution/webhook`.

## Detalhes técnicos
- TanStack Start com build Node (preset node-server) para rodar fora do Cloudflare.
- Lovable Cloud: auth (e-mail/senha, 1 admin, cadastro bloqueado após o primeiro), tabelas `settings`, `knowledge_items`, `conversations`, `messages`, `webhook_events`; bucket privado `knowledge`.
- Chaves salvas no banco, acessíveis só pelo admin (RLS) e lidas apenas no servidor.
- Busca no conhecimento: seleção dos trechos mais relevantes por palavras-chave (sem custo de embeddings); contexto limitado para respostas rápidas.
- Webhook protegido por token secreto na URL, configurado na tela de chaves.
- Histórico das últimas mensagens do contato incluído na resposta.
