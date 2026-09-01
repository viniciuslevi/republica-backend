# republica-backend

API do [RepublicApp](../RepublicApp) — organização de tarefas, despesas e listas de compras de repúblicas/moradias compartilhadas.

## Stack

Node.js + TypeScript + [Fastify](https://fastify.dev/) + MongoDB (Mongoose) + Zod + JWT.

## Estrutura

```
src/
  modules/
    auth/          # registro, login, refresh
    residences/     # criar residência, entrar por código, membros
    tasks/          # CRUD de tarefas + recorrência (Única/Diária/Semanal/Mensal)
    expenses/       # registro de despesas + resumo de saldos
    shopping/       # lista de compras compartilhada
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

Todas as rotas (exceto `/auth/*` e `/health`) exigem `Authorization: Bearer <accessToken>`.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `POST /residences` — cria residência (retorna `code` de convite)
- `POST /residences/join` — entra em uma residência pelo `code`
- `GET /residences` — lista residências do usuário autenticado
- `GET /residences/:residenceId` — detalhe (só membros)
- `GET|POST /residences/:residenceId/tasks`, `PATCH|DELETE /:taskId`, `POST /:taskId/complete|reopen`, `GET /upcoming-occurrences`
- `GET|POST /residences/:residenceId/expenses`, `DELETE /:expenseId`, `GET /summary`
- `GET|POST /residences/:residenceId/shopping-items`, `PATCH|DELETE /:itemId`

Todas as rotas de tarefas/despesas/compras exigem que o usuário autenticado seja membro da residência (`:residenceId`), verificado pelo middleware `requireMembership`.

## Testes

```bash
npm test
```

(usa `mongodb-memory-server` para testes de integração isolados, sem depender de um Mongo externo)
