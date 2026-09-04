# API do republica-backend

Referência completa dos endpoints. Todos os corpos de requisição/resposta são JSON.

Base URL local padrão: `http://localhost:3000` (`PORT`/`HOST` configuráveis em `.env`, ver [.env.example](../.env.example)).

> **Escopo atual:** apenas autenticação, residências e tarefas. Despesas e lista de compras foram removidas temporariamente (ver `README.md`).

## Sumário

- [Autenticação](#autenticação)
- [Erros](#formato-de-erro)
- [Auth](#auth)
- [Residences](#residences)
- [Tasks](#tasks-aninhado-em-residencesresidenceidtasks)

## Autenticação

A API usa JWT em dois tokens:

- **accessToken** — vida curta (`JWT_ACCESS_EXPIRES_IN`, padrão 15 min). Enviado em toda rota protegida via header `Authorization: Bearer <accessToken>`.
- **refreshToken** — vida longa (`JWT_REFRESH_EXPIRES_IN`, padrão 30 dias). Usado só em `POST /auth/refresh` para obter um novo par de tokens.

Rotas sob `/residences/:residenceId/...` (tasks incluído) exigem, além do JWT válido, que o usuário autenticado seja **membro** daquela residência — verificado pelo middleware `requireMembership`. Quem não é membro recebe `403`.

## Formato de erro

Todo erro de validação (Zod) ou de negócio (`AppError`) segue o mesmo formato:

```json
{ "error": "Mensagem legível em português" }
```

Erros de validação de schema incluem também `issues` com os campos inválidos:

```json
{
  "error": "Dados inválidos",
  "issues": { "email": ["Informe um e-mail válido"] }
}
```

Códigos HTTP usados: `400` (validação/regra de negócio), `401` (não autenticado / token inválido), `403` (autenticado mas sem permissão), `404` (recurso não encontrado), `409` (conflito, ex.: e-mail já cadastrado), `500` (erro interno).

---

## Auth

### `POST /auth/register`

Cria uma conta e já retorna os tokens (login automático).

Body:

```json
{ "name": "Ana Souza", "email": "ana@republica.com", "password": "123456", "phone": "(87) 99999-0000" }
```

`phone` é opcional. `password` exige no mínimo 3 caracteres.

201:

```json
{
  "user": { "id": "665f...", "name": "Ana Souza", "email": "ana@republica.com", "phone": "(87) 99999-0000" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

409 se o e-mail já estiver cadastrado.

### `POST /auth/login`

Body: `{ "email": "ana@republica.com", "password": "123456" }`

200: mesmo formato de `/auth/register`. 401 se e-mail ou senha estiverem incorretos (mensagem genérica, não revela qual dos dois).

### `POST /auth/refresh`

Body: `{ "refreshToken": "..." }`

200: `{ "accessToken": "...", "refreshToken": "..." }` (novo par — o refresh token antigo continua tecnicamente válido até expirar; não há revogação/blacklist nesta versão). 401 se o refresh token for inválido/expirado ou o usuário não existir mais.

---

## Residences

Base: `/residences`. Todas exigem `Authorization: Bearer <accessToken>`.

### `POST /residences`

Cria uma residência. Quem cria vira `adminId` e primeiro membro.

Body: `{ "name": "República Solar", "address": "Rua X, 120", "description": "opcional" }` (`address`/`description` opcionais)

201 — retorna a residência criada, incluindo o `code` de convite gerado (formato `REP-XXXX`):

```json
{
  "_id": "665f...",
  "name": "República Solar",
  "code": "REP-9P66",
  "address": "Rua X, 120",
  "adminId": "665f...",
  "members": ["665f..."],
  "plan": "free",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `POST /residences/join`

Entra em uma residência existente pelo código de convite.

Body: `{ "code": "REP-9P66" }` (case-insensitive, normalizado para maiúsculas)

200 — retorna a residência atualizada (usuário adicionado a `members`, idempotente se já for membro). 404 se o código não existir.

### `GET /residences`

Lista as residências das quais o usuário autenticado é membro, mais recentes primeiro.

200: array de residências (mesmo formato do `POST /residences`, sem `members` populados).

### `GET /residences/:residenceId`

Detalhe de uma residência, com `members` **populados** (`{ _id, name, email }` em vez de só o ObjectId). Exige que o usuário seja membro (403 caso contrário).

### `DELETE /residences/:residenceId/members/:memberId`

Remove um morador da residência. Regras:

- Só o `adminId` da residência pode chamar esta rota (403 para qualquer outro membro).
- O admin não pode remover a si mesmo (400 — transferência de admin não é suportada nesta versão).
- Não é possível remover o último morador restante (400).
- Tarefas da residência atribuídas ao morador removido voltam a `assigneeId: null` automaticamente.

200 — retorna a residência atualizada. 404 se o `memberId` não for membro da residência.

---

## Tasks (aninhado em `/residences/:residenceId/tasks`)

Valores válidos: `recurrence` ∈ `Única | Diária | Semanal | Mensal`; `priority` ∈ `Baixa | Média | Alta`.

### `GET /residences/:residenceId/tasks`

Lista as tarefas da residência. Antes de responder, aplica o **reset de recorrência preguiçoso**: qualquer tarefa recorrente concluída cujo ciclo já expirou volta para `done: false` automaticamente (ver `src/modules/tasks/recurrence.ts`). Isso é reforçado por um job diário (`node-cron`, 00:05) que cobre residências que ninguém abriu no app naquele dia.

200: array de tarefas.

### `POST /residences/:residenceId/tasks`

Body:

```json
{
  "title": "Lavar louça",
  "description": "opcional",
  "assigneeId": "665f...",
  "recurrence": "Diária",
  "priority": "Alta"
}
```

Todos os campos exceto `title` são opcionais (`recurrence` padrão `Única`, `priority` padrão `Média`, `assigneeId` padrão `null`). 201 — retorna a tarefa criada, com `nextDueDate` já calculado se `recurrence !== "Única"`.

### `PATCH /residences/:residenceId/tasks/:taskId`

Body: subconjunto de `{ title, description, assigneeId, recurrence, priority }`. Trocar `recurrence` recalcula `nextDueDate`. 200 — tarefa atualizada. 404 se não existir na residência.

### `DELETE /residences/:residenceId/tasks/:taskId`

204 sem corpo. 404 se não existir.

### `POST /residences/:residenceId/tasks/:taskId/complete`

Marca `done: true` e `lastCompletedAt: <agora>`. 200 — tarefa atualizada.

### `POST /residences/:residenceId/tasks/:taskId/reopen`

Marca `done: false` e `lastCompletedAt: null`. 200 — tarefa atualizada.

### `GET /residences/:residenceId/tasks/upcoming-occurrences`

Projeta as próximas ocorrências das tarefas recorrentes (tarefas `Única` são ignoradas).

Query params opcionais: `horizonDays` (padrão 30, máx. 365), `occurrencesPerTask` (padrão 6, máx. 50).

200:

```json
[
  { "taskId": "665f...", "title": "Lavar louça", "assigneeId": "665f...", "recurrence": "Diária", "date": "2026-09-02T03:00:00.000Z" }
]
```

Ordenado por `date` crescente.

---

## Expenses (aninhado em `/residences/:residenceId/expenses` e top-level `/expenses`)

Todas as rotas exigem autenticação JWT e verificação de que o usuário pertence à residência.

### `GET /residences/:residenceId/expenses`

Lista as despesas da residência, ordenadas pela data de criação decrescente (mais recente primeiro).

200: array de despesas.

### `POST /residences/:residenceId/expenses`

Body:

```json
{
  "description": "Conta de luz",
  "value": 150.75,
  "payerId": "665f...",
  "participantIds": ["665f...", "665f..."]
}
```

- `description`: Obrigatório (texto não-vazio).
- `value`: Obrigatório (número positivo maior que zero).
- `payerId`: Obrigatório (id do morador da residência que pagou).
- `participantIds`: Opcional (array de ids dos moradores participantes; se omitido ou vazio, divide entre todos os membros da residência).

201: retorna a despesa criada.

### `DELETE /residences/:residenceId/expenses/:expenseId`

Remove a despesa especificada. 204: sem conteúdo.

### `POST /expenses`

Endpoint alternativo top-level. Aceita os mesmos campos no corpo acrescido de `residenceId` (opcional caso o usuário autenticado pertença a exatamente uma residência).

201: retorna a despesa criada.
