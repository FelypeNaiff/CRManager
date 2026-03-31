# CRManager

Plataforma full-stack SaaS multi-tenant que unifica CRM, ERP, PDV, automações de WhatsApp/Marketing IA, estoque, financeiro, BI e portal do cliente.

## Estrutura

```txt
/backend
  /modules
  /controllers
  /services
  /repositories
  /middlewares
  /routes
/frontend
  /pages
  /components
  /layouts
  /hooks
  /store
```

## Funcionalidades implementadas nesta versão

- Multi-tenant por `loja_id` + header obrigatório `x-loja-id`.
- JWT Auth + RBAC base.
- CRM (clientes por telefone, interações, segmentação).
- CRM Infantil (filhos, idade automática, sugestão de tamanho atual e próximo).
- Portal do cliente (frontend separado por rota `/portal`, com fluxo OTP documentado).
- Engine de automação WhatsApp com gatilhos e webhook.
- IA de marketing (mock para gerar campanhas e segmentação automática).
- Módulos ERP/PDV/Estoque/Compras/Fiscal/Omnichannel/Meta Ads/Agenda/BI via rotas modulares.
- WebSocket (Socket.IO) para notificações em tempo real por loja.
- Banco PostgreSQL com schema inicial.

## Como rodar

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env # opcional
npm run dev
```

Backend em `http://localhost:4000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend em `http://localhost:5173`.

## Variáveis backend

Crie `backend/.env` com:

```env
PORT=4000
JWT_SECRET=crmanager-dev-secret
DATABASE_URL=postgres://postgres:postgres@localhost:5432/crmanager
```

## Banco de dados

Executar script:

```bash
psql "$DATABASE_URL" -f backend/schema.sql
```

## API e exemplos

Veja `docs/api-examples.md`.

## Próximos passos recomendados

1. Persistir módulos em tabelas dedicadas (substituir store in-memory).
2. Implementar funil drag-and-drop visual no frontend.
3. Adicionar filas assíncronas (BullMQ + Redis) para automações e webhooks.
4. Integrar provedores reais: WhatsApp Business API, Meta Ads, gateway bancário e emissão fiscal.
