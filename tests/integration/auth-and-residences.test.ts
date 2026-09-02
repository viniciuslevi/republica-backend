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
});
