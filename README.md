# republica-backend

API do [RepublicApp](../RepublicApp) — organização de tarefas de repúblicas/moradias compartilhadas.

> Despesas e lista de compras foram removidas temporariamente desta API (o app mobile continua com esses recursos localmente, sem backend, até serem reintroduzidos aqui).

Documentação completa dos endpoints: [docs/API.md](docs/API.md).

## Stack

Node.js + TypeScript + [Fastify](https://fastify.dev/) + MongoDB (Mongoose) + Zod + JWT.

## Estrutura

```
src/
  modules/
    auth/          # registro, login, refresh
    residences/    # criar residência, entrar por código, membros, remoção de membro
    tasks/         # CRUD de tarefas + recorrência (Única/Diária/Semanal/Mensal)
  shared/
    config/         # variáveis de ambiente (validadas com zod)
    database/       # conexão com o MongoDB
    errors/         # AppError e subclasses (404, 401, 403, 409)
    jobs/           # reset diário de tarefas recorrentes (fallback do node-cron)
    middlewares/    # requireMembership (isola dados por residência)
    plugins/        # error handler global, autenticação (JWT)
    security/       # emissão/verificação de access e refresh tokens
  app.ts            # monta o Fastify e registra plugins/rotas
  server.ts         # conecta ao Mongo, agenda jobs e sobe o servidor
```

Cada módulo de domínio segue `*.model.ts` (schema Mongoose) → `*.schema.ts` (validação Zod) → `*.service.ts` (regras de negócio) → `*.controller.ts` (HTTP) → `*.routes.ts`.

## Como rodar

```bash
cp .env.example .env
# edite MONGODB_URI se necessário (padrão: mongodb://localhost:27017/republica)

npm install
npm run dev
```

O servidor sobe em `http://localhost:3000`. `GET /health` para checar se está no ar.

## Rotas principais

Todas as rotas (exceto `/auth/*` e `/health`) exigem `Authorization: Bearer <accessToken>`. Referência completa (payloads, respostas, erros) em [docs/API.md](docs/API.md).

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `POST /residences` — cria residência (retorna `code` de convite)
- `POST /residences/join` — entra em uma residência pelo `code`
- `GET /residences` — lista residências do usuário autenticado
- `GET /residences/:residenceId` — detalhe com membros populados (só membros)
- `DELETE /residences/:residenceId/members/:memberId` — remove um morador (só o admin; admin não pode se auto-remover; último morador não pode ser removido)
- `GET|POST /residences/:residenceId/tasks`, `PATCH|DELETE /:taskId`, `POST /:taskId/complete|reopen`, `GET /upcoming-occurrences`

Todas as rotas de tarefas exigem que o usuário autenticado seja membro da residência (`:residenceId`), verificado pelo middleware `requireMembership`.

## Testes

```bash
npm test
```

(usa `mongodb-memory-server` para testes de integração isolados, sem depender de um Mongo externo)

## Deploy

Recomendado: **Render** (API) + **MongoDB Atlas** (banco), ambos com plano gratuito — combinação mais simples para o stack (Node/Fastify + Mongoose).

### 1. Banco de dados (MongoDB Atlas)

1. Crie uma conta em [mongodb.com/atlas](https://www.mongodb.com/atlas) e um cluster gratuito (M0).
2. Em **Database Access**, crie um usuário de banco (usuário + senha).
3. Em **Network Access**, adicione `0.0.0.0/0` ("Allow access from anywhere") — o Render não usa IP fixo no plano free, então não dá pra restringir por IP; a segurança fica a cargo da senha do usuário do banco.
4. Em **Connect → Drivers**, copie a connection string (formato `mongodb+srv://<usuario>:<senha>@.../<database>?retryWrites=true&w=majority`).

### 2. API (Render)

O repositório já tem uma blueprint (`render.yaml`) pronta:

1. Suba este repositório para o GitHub (se ainda não estiver lá).
2. No [dashboard do Render](https://dashboard.render.com), **New → Blueprint**, conecte o repositório — o Render lê o `render.yaml` automaticamente (build `npm install && npm run build`, start `npm start`, health check em `/health`).
3. Quando pedir a variável `MONGODB_URI`, cole a connection string do Atlas (com a senha e o nome do banco já preenchidos).
4. `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` são gerados automaticamente pelo Render (`generateValue: true`) — não precisa preencher.
5. Deploy. A URL pública fica algo como `https://republica-backend.onrender.com`.

**Nota:** no plano free o serviço "dorme" após ~15 min sem receber requisições — a primeira chamada depois disso demora uns 30-50s pra acordar. Normal para uso de demonstração/acadêmico.

### 3. Conectar o app mobile à API deployada

No `RepublicApp`, defina `EXPO_PUBLIC_API_URL=https://<seu-app>.onrender.com` (arquivo `.env` na raiz do app, ou como variável de ambiente do build no EAS) — ver o README do `RepublicApp` para detalhes.
