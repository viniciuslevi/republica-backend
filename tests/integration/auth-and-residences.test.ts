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

describe("auth + residências", () => {
  it("GET /residences/:id retorna os membros populados (nome e e-mail, não só o id)", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Débora", email: "debora@republica.com", password: "123456" },
    });
    const { accessToken, user } = register.json();

    const createResidence = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Rep Populada" },
    });
    const residence = createResidence.json();

    const detail = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({ _id: user.id, name: "Débora", email: "debora@republica.com" });
  });

  it("registra, cria residência, bloqueia quem não é membro e libera após entrar pelo código", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Ana", email: "ana@republica.com", password: "123456" },
    });
    expect(register.statusCode).toBe(201);
    const { accessToken } = register.json();

    const createResidence = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Rep Teste" },
    });
    expect(createResidence.statusCode).toBe(201);
    const residence = createResidence.json();
    expect(residence.code).toMatch(/^REP-/);

    const outsiderRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Carla", email: "carla@republica.com", password: "123456" },
    });
    const outsiderToken = outsiderRegister.json().accessToken;

    const blocked = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(blocked.statusCode).toBe(403);

    const joined = await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${outsiderToken}` },
      payload: { code: residence.code },
    });
    expect(joined.statusCode).toBe(200);

    const allowed = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual([]);
  });

  it("rejeita login com senha incorreta", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Bruno", email: "bruno@republica.com", password: "123456" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "bruno@republica.com", password: "senha-errada" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("permite que o admin remova um morador e desatribui as tarefas dele; bloqueia quem não é admin", async () => {
    const ana = (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name: "Ana", email: "ana2@republica.com", password: "123456" },
      })
    ).json();

    const bruno = (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name: "Bruno", email: "bruno2@republica.com", password: "123456" },
      })
    ).json();

    const residence = (
      await app.inject({
        method: "POST",
        url: "/residences",
        headers: { authorization: `Bearer ${ana.accessToken}` },
        payload: { name: "Rep Moradores" },
      })
    ).json();

    await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${bruno.accessToken}` },
      payload: { code: residence.code },
    });

    const task = (
      await app.inject({
        method: "POST",
        url: `/residences/${residence._id}/tasks`,
        headers: { authorization: `Bearer ${ana.accessToken}` },
        payload: { title: "Lavar louça", assigneeId: bruno.user.id },
      })
    ).json();

    const blockedRemoval = await app.inject({
      method: "DELETE",
      url: `/residences/${residence._id}/members/${ana.user.id}`,
      headers: { authorization: `Bearer ${bruno.accessToken}` },
    });
    expect(blockedRemoval.statusCode).toBe(403);

    const adminSelfRemoval = await app.inject({
      method: "DELETE",
      url: `/residences/${residence._id}/members/${ana.user.id}`,
      headers: { authorization: `Bearer ${ana.accessToken}` },
    });
    expect(adminSelfRemoval.statusCode).toBe(400);

    const removal = await app.inject({
      method: "DELETE",
      url: `/residences/${residence._id}/members/${bruno.user.id}`,
      headers: { authorization: `Bearer ${ana.accessToken}` },
    });
    expect(removal.statusCode).toBe(200);
    expect(removal.json().members).not.toContain(bruno.user.id);

    const tasksAfter = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${ana.accessToken}` },
    });
    const updatedTask = tasksAfter.json().find((t: { _id: string }) => t._id === task._id);
    expect(updatedTask.assigneeId).toBeNull();
  });

  it("cria e atualiza tarefas com data/hora e regras de periodicidade (única, diária, semanal e mensal)", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Marcos", email: "marcos@republica.com", password: "123456" },
    });
    const { accessToken } = register.json();

    const rep = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Rep Agendada" },
    });
    const residence = rep.json();

    // 1. Tarefa Única com dia e horário opcionais
    const single = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Comprar lâmpada",
        recurrence: "Única",
        dueDate: "2026-09-15",
        dueTime: "14:30",
      },
    });
    expect(single.statusCode).toBe(201);
    expect(single.json().dueTime).toBe("14:30");
    expect(single.json().nextDueDate).not.toBeNull();

    // 2. Tarefa Semanal: weekDay é obrigatório
    const weeklyInvalid = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Lavar quintal",
        recurrence: "Semanal",
      },
    });
    expect(weeklyInvalid.statusCode).toBe(400);

    const weeklyValid = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Lavar quintal",
        recurrence: "Semanal",
        weekDay: 6, // Sábado
        dueTime: "09:00",
      },
    });
    expect(weeklyValid.statusCode).toBe(201);
    expect(weeklyValid.json().weekDay).toBe(6);
    expect(weeklyValid.json().dueTime).toBe("09:00");

    // 3. Tarefa Mensal: monthDay é obrigatório
    const monthlyInvalid = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Pagar aluguel",
        recurrence: "Mensal",
      },
    });
    expect(monthlyInvalid.statusCode).toBe(400);

    const monthlyValid = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/tasks`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Pagar aluguel",
        recurrence: "Mensal",
        monthDay: 10,
        dueTime: "12:00",
      },
    });
    expect(monthlyValid.statusCode).toBe(201);
    expect(monthlyValid.json().monthDay).toBe(10);
    expect(monthlyValid.json().dueTime).toBe("12:00");

    // 4. Edição de tarefa: alterar agendamento
    const edit = await app.inject({
      method: "PATCH",
      url: `/residences/${residence._id}/tasks/${single.json()._id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Comprar lâmpada LED urgente",
        dueTime: "17:00",
      },
    });
    expect(edit.statusCode).toBe(200);
    expect(edit.json().title).toBe("Comprar lâmpada LED urgente");
    expect(edit.json().dueTime).toBe("17:00");
  });
});
