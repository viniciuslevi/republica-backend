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

  it("calcula o resumo de saldos das despesas dividindo igualmente entre participantes", async () => {
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
        payload: { name: "Rep Saldos" },
      })
    ).json();

    await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${bruno.accessToken}` },
      payload: { code: residence.code },
    });

    await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${ana.accessToken}` },
      payload: {
        description: "Conta de luz",
        value: 200,
        payerId: ana.user.id,
        participantIds: [ana.user.id, bruno.user.id],
      },
    });

    const summary = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/expenses/summary`,
      headers: { authorization: `Bearer ${ana.accessToken}` },
    });

    expect(summary.statusCode).toBe(200);
    const body = summary.json();
    expect(body.totalExpenses).toBe(200);

    const anaBalance = body.balances.find((b: { resident: { id: string } }) => b.resident.id === ana.user.id);
    const brunoBalance = body.balances.find((b: { resident: { id: string } }) => b.resident.id === bruno.user.id);
    expect(anaBalance.balance).toBe(100);
    expect(brunoBalance.balance).toBe(-100);
  });
});
