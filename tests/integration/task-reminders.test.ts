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

describe("automação de lembretes de tarefas recorrentes (SCRUM-27)", () => {
  async function setupResidence() {
    const registerResp = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Yago", email: "yago@republica.com", password: "123456" },
    });
    const token = registerResp.json().accessToken;

    const residenceResp = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "República Teste" },
    });
    const residence = residenceResp.json();
    const residenceId = residence._id || residence.id;

    return { token, residenceId };
  }

  it("bloqueia acesso aos lembretes se a residência estiver no plano gratuito (403)", async () => {
    const { token, residenceId } = await setupResidence();

    const response = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/tasks/reminders`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Recurso exclusivo para repúblicas no plano Premium",
    });
  });

  it("retorna tarefas recorrentes atrasadas ou próximas do vencimento no plano premium", async () => {
    const { token, residenceId } = await setupResidence();

    await app.inject({
      method: "PATCH",
      url: `/residences/${residenceId}/plan`,
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: "premium" },
    });

    // Tarefa diária (nextDueDate calculado automaticamente para dentro de 24h)
    const dueSoon = await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Lavar louça", recurrence: "Diária" },
    });
    const dueSoonId = dueSoon.json()._id || dueSoon.json().id;

    // Tarefa única não deve aparecer nos lembretes (não tem recorrência)
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Comprar sofá" },
    });

    // Tarefa mensal com vencimento distante (~10 dias) não deve aparecer na janela padrão de 48h
    const distantMonthDay = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).getDate();
    await app.inject({
      method: "POST",
      url: `/residences/${residenceId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Trocar filtro do ar-condicionado", recurrence: "Mensal", monthDay: distantMonthDay },
    });

    const response = await app.inject({
      method: "GET",
      url: `/residences/${residenceId}/tasks/reminders`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const reminders = response.json();

    expect(reminders).toHaveLength(1);
    expect(reminders[0].taskId).toBe(dueSoonId);
    expect(reminders[0].title).toBe("Lavar louça");
    expect(typeof reminders[0].minutesUntilDue).toBe("number");
  });
});
