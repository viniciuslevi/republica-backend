import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../../src/app.js";
import { connectDatabase, disconnectDatabase } from "../../src/shared/database/connection.js";
import { TaskModel } from "../../src/modules/tasks/task.model.js";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

describe("Fluxo e Transições de Status de Tarefas (SCRUM-146)", () => {
  async function setupResidence() {
    const registerResp = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Morador Teste", email: "morador@republica.com", password: "password123" },
    });
    const token = registerResp.json().accessToken;

    const residenceResp = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "República das Flores" },
    });
    const residence = residenceResp.json();
    const residenceId = residence._id || residence.id;

    return { token, residenceId };
  }

  it("ao criar uma tarefa, o status inicial padrão é 'A fazer' com done=false", async () => {
    const { token, residenceId } = await setupResidence();

    const response = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "Lavar a louça",
        priority: "Alta",
        recurrence: "Diária",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.title).toBe("Lavar a louça");
    expect(body.status).toBe("A fazer");
    expect(body.done).toBe(false);
    expect(body.lastCompletedAt).toBeNull();
  });

  it("permite transicionar o status para 'Em andamento', 'Feito', 'Cancelada' e de volta para 'A fazer'", async () => {
    const { token, residenceId } = await setupResidence();

    // 1. Criar tarefa
    const createResp = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Limpar o quintal" },
    });
    const task = createResp.json();
    const taskId = task._id || task.id;

    // 2. Transicionar para "Em andamento"
    const inProgressResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/tasks/${taskId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "Em andamento" },
    });
    expect(inProgressResp.statusCode).toBe(200);
    const inProgressData = inProgressResp.json();
    expect(inProgressData.status).toBe("Em andamento");
    expect(inProgressData.done).toBe(false);

    // 3. Transicionar para "Feito"
    const doneResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/tasks/${taskId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "Feito" },
    });
    expect(doneResp.statusCode).toBe(200);
    const doneData = doneResp.json();
    expect(doneData.status).toBe("Feito");
    expect(doneData.done).toBe(true);
    expect(doneData.lastCompletedAt).not.toBeNull();

    // 4. Transicionar para "Cancelada"
    const canceledResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/tasks/${taskId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "Cancelada" },
    });
    expect(canceledResp.statusCode).toBe(200);
    const canceledData = canceledResp.json();
    expect(canceledData.status).toBe("Cancelada");
    expect(canceledData.done).toBe(true);

    // 5. Transicionar de volta para "A fazer" (desarquivar / reabrir)
    const reopenResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/tasks/${taskId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "A fazer" },
    });
    expect(reopenResp.statusCode).toBe(200);
    const reopenData = reopenResp.json();
    expect(reopenData.status).toBe("A fazer");
    expect(reopenData.done).toBe(false);
    expect(reopenData.lastCompletedAt).toBeNull();
  });

  it("atualiza status também via PATCH /tasks/:taskId genérico", async () => {
    const { token, residenceId } = await setupResidence();

    const createResp = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Consertar pia" },
    });
    const taskId = createResp.json()._id;

    const patchResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/tasks/${taskId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "Em andamento", description: "Vazamento no sifão" },
    });

    expect(patchResp.statusCode).toBe(200);
    const body = patchResp.json();
    expect(body.status).toBe("Em andamento");
    expect(body.description).toBe("Vazamento no sifão");
    expect(body.done).toBe(false);
  });

  it("rejeita status inválido com HTTP 400", async () => {
    const { token, residenceId } = await setupResidence();

    const createResp = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Tarefa Teste" },
    });
    const taskId = createResp.json()._id;

    const response = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/tasks/${taskId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "StatusInexistente" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("endpoints /complete e /reopen mantêm compatibilidade sincronizando o status", async () => {
    const { token, residenceId } = await setupResidence();

    const createResp = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Tirar o lixo" },
    });
    const taskId = createResp.json()._id;

    // Concluir via /complete
    const completeResp = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${taskId}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(completeResp.statusCode).toBe(200);
    expect(completeResp.json().status).toBe("Feito");
    expect(completeResp.json().done).toBe(true);

    // Reabrir via /reopen
    const reopenResp = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${taskId}/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reopenResp.statusCode).toBe(200);
    expect(reopenResp.json().status).toBe("A fazer");
    expect(reopenResp.json().done).toBe(false);
  });

  it("ao resetar tarefa recorrente no lazy reset, o status volta para 'A fazer'", async () => {
    const { token, residenceId } = await setupResidence();

    // Tarefa diária concluída ontem
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const taskDoc = await TaskModel.create({
      residenceId,
      title: "Varrer a casa",
      recurrence: "Diária",
      priority: "Média",
      status: "Feito",
      done: true,
      lastCompletedAt: yesterday,
      nextDueDate: yesterday,
    });

    // Ao listar tarefas, lazy reset deve ser acionado
    const listResp = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listResp.statusCode).toBe(200);
    const tasks = listResp.json();
    const found = tasks.find((t: any) => t._id === taskDoc._id.toString());
    expect(found).toBeDefined();
    expect(found.done).toBe(false);
    expect(found.status).toBe("A fazer");
  });
});
