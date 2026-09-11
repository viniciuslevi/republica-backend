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

describe("módulo de relatórios premium (reports)", () => {
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

  it("deve bloquear acesso ao relatório agregado se a residência estiver no plano gratuito (403)", async () => {
    const { token1, residenceId } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/reports/summary`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Recurso exclusivo para repúblicas no plano Premium",
    });
  });

  it("apenas o administrador da residência pode atualizar o plano", async () => {
    const { token1, token2, residenceId } = await setupResidenceWithTwoMembers();

    // user2 (não-admin) tenta alterar plano
    const failResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/plan`,
      headers: { authorization: `Bearer ${token2}` },
      payload: { plan: "premium" },
    });
    expect(failResp.statusCode).toBe(403);
    expect(failResp.json().error).toContain("administrador");

    // user1 (admin) altera o plano para premium com sucesso
    const successResp = await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/plan`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { plan: "premium" },
    });
    expect(successResp.statusCode).toBe(200);
    expect(successResp.json().plan).toBe("premium");
  });

  it("deve gerar o relatório agregado de despesas e tarefas concluídas por membro no plano premium", async () => {
    const { token1, residenceId, userId1, userId2 } = await setupResidenceWithTwoMembers();

    // Upgrade para plano premium
    await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/plan`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { plan: "premium" },
    });

    // Registra 2 despesas
    // Despesa 1: R$ 100 paga por user1 rateada entre user1 e user2
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Supermercado",
        value: 100,
        payerId: userId1,
        participantIds: [userId1, userId2],
        date: "2026-03-10T12:00:00.000Z",
      },
    });

    // Despesa 2: R$ 50 paga por user2 rateada entre user1 e user2
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Material de limpeza",
        value: 50,
        payerId: userId2,
        participantIds: [userId1, userId2],
        date: "2026-03-15T12:00:00.000Z",
      },
    });

    // Cria tarefas
    // Tarefa 1: atribuída a user1, concluída
    const t1 = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { title: "Lavar cozinha", assigneeId: userId1 },
    });
    const taskId1 = t1.json()._id || t1.json().id;
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${taskId1}/complete`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Tarefa 2: atribuída a user2, concluída
    const t2 = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { title: "Tirar lixo", assigneeId: userId2 },
    });
    const taskId2 = t2.json()._id || t2.json().id;
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks/${taskId2}/complete`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Tarefa 3: atribuída a user1, NÃO concluída
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { title: "Varrer quintal", assigneeId: userId1 },
    });

    // Chama o relatório
    const reportResp = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/reports/summary`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(reportResp.statusCode).toBe(200);
    const data = reportResp.json();

    expect(data.totalExpenses).toBe(150);
    expect(data.totalCompletedTasks).toBe(2);

    const rUser1 = data.membersReport.find((m: any) => m.resident.id === userId1);
    const rUser2 = data.membersReport.find((m: any) => m.resident.id === userId2);

    expect(rUser1).toBeDefined();
    expect(rUser1.totalExpensesPaid).toBe(100);
    expect(rUser1.totalExpensesShare).toBe(75); // 50 + 25
    expect(rUser1.completedTasksCount).toBe(1);

    expect(rUser2).toBeDefined();
    expect(rUser2.totalExpensesPaid).toBe(50);
    expect(rUser2.totalExpensesShare).toBe(75); // 50 + 25
    expect(rUser2.completedTasksCount).toBe(1);
  });

  it("deve filtrar despesas e tarefas pelo período de datas informado", async () => {
    const { token1, residenceId, userId1 } = await setupResidenceWithTwoMembers();

    // Upgrade para plano premium
    await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/plan`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { plan: "premium" },
    });

    // Despesa em Janeiro
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Internet Jan",
        value: 120,
        payerId: userId1,
        date: "2026-01-10T10:00:00.000Z",
      },
    });

    // Despesa em Março
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Internet Março",
        value: 140,
        payerId: userId1,
        date: "2026-03-10T10:00:00.000Z",
      },
    });

    // Consulta filtrando apenas Março de 2026
    const reportResp = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/reports/summary?startDate=2026-03-01&endDate=2026-03-31`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(reportResp.statusCode).toBe(200);
    const data = reportResp.json();

    // Apenas a despesa de Março (140) deve constar
    expect(data.totalExpenses).toBe(140);
    const rUser1 = data.membersReport.find((m: any) => m.resident.id === userId1);
    expect(rUser1.totalExpensesPaid).toBe(140);
  });
});
