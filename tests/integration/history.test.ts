import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../../src/app.js";
import { connectDatabase, disconnectDatabase } from "../../src/shared/database/connection.js";

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

describe("módulo de histórico unificado (SCRUM-82)", () => {
  async function setupResidenceWithTwoMembers() {
    const r1 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Yago", email: "yago@republica.com", password: "123456" },
    });
    const user1 = r1.json().user;
    const token1 = r1.json().accessToken;

    const r2 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Alice", email: "alice@republica.com", password: "123456" },
    });
    const user2 = r2.json().user;
    const token2 = r2.json().accessToken;

    const resCreated = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "República Teste" },
    });
    const residence = resCreated.json();

    // user2 entra na residência com o código de convite
    await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${token2}` },
      payload: { code: residence.code },
    });

    const residenceId = residence._id || residence.id;
    const userId1 = user1._id || user1.id;
    const userId2 = user2._id || user2.id;

    return { user1, token1, user2, token2, residence, residenceId, userId1, userId2 };
  }

  it("deve bloquear acesso ao histórico sem autenticação (401)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/residences/665f00000000000000000001/history",
    });

    expect(response.statusCode).toBe(401);
  });

  it("deve bloquear acesso ao histórico para usuário que não é membro da residência (403)", async () => {
    const { residenceId } = await setupResidenceWithTwoMembers();

    const strangerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Estranho", email: "estranho@republica.com", password: "123456" },
    });
    const strangerToken = strangerRes.json().accessToken;

    const response = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toHaveProperty("error");
  });

  it("deve retornar 404 se a residência não existir", async () => {
    const r1 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Tester", email: "tester@republica.com", password: "123456" },
    });
    const token = r1.json().accessToken;

    const fakeId = new mongoose.Types.ObjectId().toString();
    const response = await app.inject({
      method: "GET",
      url: `/residences/${fakeId}/history`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("deve retornar array vazio quando não há registros de tarefas ou despesas (sem histórico)", async () => {
    const { token1, residenceId } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("deve listar tarefas concluídas e despesas em ordem cronológica decrescente com responsável e descrição", async () => {
    const { token1, residenceId, userId1, userId2 } = await setupResidenceWithTwoMembers();

    // 1. Criar e concluir uma tarefa
    const taskRes = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        title: "Limpar a cozinha",
        description: "Lavar a louça e o fogão",
        assigneeId: userId1,
        priority: "Alta",
      },
    });
    const task = taskRes.json();
    const taskId = task._id || task.id;

    // Completar tarefa
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${taskId}/complete`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // 2. Criar uma tarefa NÃO concluída (não deve aparecer no histórico)
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        title: "Comprar lâmpada",
        assigneeId: userId2,
        priority: "Baixa",
      },
    });

    // 3. Criar uma despesa registrada por user2
    const expRes = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Conta de internet",
        value: 120.5,
        payerId: userId2,
        date: new Date(Date.now() + 1000).toISOString(),
      },
    });
    expect(expRes.statusCode).toBe(201);

    // Consultar histórico
    const historyRes = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json();

    // Deve conter exatamente 2 itens (tarefa concluída + despesa)
    expect(history.length).toBe(2);

    // Primeiro item deve ser a despesa (data mais recente)
    const expenseItem = history[0];
    expect(expenseItem.type).toBe("expense");
    expect(expenseItem.description).toBe("Conta de internet");
    expect(expenseItem.value).toBe(120.5);
    expect(expenseItem.personName).toBe("Alice");
    expect(expenseItem.responsible.name).toBe("Alice");
    expect(expenseItem.payer.name).toBe("Alice");
    expect(expenseItem.date).toBeDefined();

    // Segundo item deve ser a tarefa concluída
    const taskItem = history[1];
    expect(taskItem.type).toBe("task");
    expect(taskItem.description).toBe("Limpar a cozinha");
    expect(taskItem.personName).toBe("Yago");
    expect(taskItem.responsible.name).toBe("Yago");
    expect(taskItem.priority).toBe("Alta");
    expect(taskItem.date).toBeDefined();
  });

  it("deve filtrar o histórico por tipo (tarefas ou despesas)", async () => {
    const { token1, residenceId, userId1, userId2 } = await setupResidenceWithTwoMembers();

    // Criar e concluir tarefa
    const t = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { title: "Tirar o lixo", assigneeId: userId1 },
    });
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${t.json()._id || t.json().id}/complete`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Criar despesa
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { description: "Gás de cozinha", value: 95.0, payerId: userId2 },
    });

    // Filtro por tipo task
    const taskOnlyRes = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history?type=task`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(taskOnlyRes.statusCode).toBe(200);
    const taskList = taskOnlyRes.json();
    expect(taskList.length).toBe(1);
    expect(taskList[0].type).toBe("task");
    expect(taskList[0].description).toBe("Tirar o lixo");

    // Filtro por tipo expense
    const expenseOnlyRes = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history?type=expense`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(expenseOnlyRes.statusCode).toBe(200);
    const expenseList = expenseOnlyRes.json();
    expect(expenseList.length).toBe(1);
    expect(expenseList[0].type).toBe("expense");
    expect(expenseList[0].description).toBe("Gás de cozinha");
  });

  it("deve filtrar o histórico por morador (responsável/pagador)", async () => {
    const { token1, residenceId, userId1, userId2 } = await setupResidenceWithTwoMembers();

    // Tarefa para user1
    const t1 = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { title: "Lavar louça", assigneeId: userId1 },
    });
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${t1.json()._id || t1.json().id}/complete`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Tarefa para user2
    const t2 = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { title: "Limpar banheiro", assigneeId: userId2 },
    });
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${t2.json()._id || t2.json().id}/complete`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Despesa paga por user1
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { description: "Produtos de limpeza", value: 30.0, payerId: userId1 },
    });

    // Despesa paga por user2
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { description: "Sabão em pó", value: 25.0, payerId: userId2 },
    });

    // Filtrar por user1
    const user1History = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history?residentId=${userId1}`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(user1History.statusCode).toBe(200);
    const u1List = user1History.json();
    expect(u1List.length).toBe(2);
    expect(u1List.every((item: any) => item.personId === userId1)).toBe(true);

    // Filtrar por user2
    const user2History = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/history?residentId=${userId2}`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(user2History.statusCode).toBe(200);
    const u2List = user2History.json();
    expect(u2List.length).toBe(2);
    expect(u2List.every((item: any) => item.personId === userId2)).toBe(true);
  });
});
