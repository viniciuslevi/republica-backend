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

describe("módulo de despesas (expenses)", () => {
  async function setupResidenceWithTwoMembers() {
    const r1 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Carlos", email: "carlos@republica.com", password: "123456" },
    });
    const user1 = r1.json().user;
    const token1 = r1.json().accessToken;

    const r2 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Beatriz", email: "beatriz@republica.com", password: "123456" },
    });
    const user2 = r2.json().user;
    const token2 = r2.json().accessToken;

    const resCreated = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "República dos Amigos" },
    });
    const residence = resCreated.json();

    // user2 entra na residência com o código de convite
    await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${token2}` },
      payload: { code: residence.code },
    });

    return { user1, token1, user2, token2, residence };
  }

  it("registra uma despesa com descrição, valor positivo e pagador com sucesso (HTTP 201)", async () => {
    const { token1, user1, user2, residence } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Conta de luz",
        value: 150.75,
        payerId: user1.id,
        participantIds: [user1.id, user2.id],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.description).toBe("Conta de luz");
    expect(body.value).toBe(150.75);
    expect(body.payerId).toBe(user1.id);
    expect(body.participantIds).toHaveLength(2);
    expect(body.residenceId).toBe(residence._id);
  });

  it("despesa registrada aparece no histórico do grupo (GET /residences/:residenceId/expenses)", async () => {
    const { token1, token2, user1, residence } = await setupResidenceWithTwoMembers();

    // Cria duas despesas
    await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Mercado da semana",
        value: 230.0,
        payerId: user1.id,
      },
    });

    await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Internet fibra",
        value: 99.9,
        payerId: user1.id,
      },
    });

    // O segundo morador também pode ver o histórico
    const listResponse = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token2}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const expenses = listResponse.json();
    expect(expenses).toHaveLength(2);
    expect(expenses[0].description).toBe("Internet fibra");
    expect(expenses[1].description).toBe("Mercado da semana");
  });

  it("bloqueia valor negativo ou zero com mensagem clara (HTTP 400)", async () => {
    const { token1, user1, residence } = await setupResidenceWithTwoMembers();

    const negativeRes = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Compra inválida",
        value: -25.5,
        payerId: user1.id,
      },
    });

    expect(negativeRes.statusCode).toBe(400);
    const negativeBody = negativeRes.json();
    expect(JSON.stringify(negativeBody)).toMatch(/positivo maior que zero/i);

    const zeroRes = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Compra zero",
        value: 0,
        payerId: user1.id,
      },
    });

    expect(zeroRes.statusCode).toBe(400);
  });

  it("bloqueia entrada não-numérica ou descrição vazia (HTTP 400)", async () => {
    const { token1, user1, residence } = await setupResidenceWithTwoMembers();

    const nanRes = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Item teste",
        value: "invalido",
        payerId: user1.id,
      },
    });

    expect(nanRes.statusCode).toBe(400);

    const emptyDescRes = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "   ",
        value: 50.0,
        payerId: user1.id,
      },
    });

    expect(emptyDescRes.statusCode).toBe(400);
  });

  it("bloqueia pagador que não é membro da residência (HTTP 400)", async () => {
    const { token1, residence } = await setupResidenceWithTwoMembers();

    const outsiderRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Intruso", email: "intruso@republica.com", password: "123456" },
    });
    const outsider = outsiderRegister.json().user;

    const response = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        description: "Conta externa",
        value: 80.0,
        payerId: outsider.id,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/pagador deve ser um morador/i);
  });

  it("impede acesso de usuário que não é membro da residência (HTTP 403)", async () => {
    const { residence } = await setupResidenceWithTwoMembers();

    const outsiderRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Outro", email: "outro@republica.com", password: "123456" },
    });
    const outsiderToken = outsiderRegister.json().accessToken;

    const listResponse = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/expenses`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });

    expect(listResponse.statusCode).toBe(403);
  });

  it("permite registrar despesa via endpoint top-level POST /expenses", async () => {
    const { token1, user1, residence } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "POST",
      url: "/expenses",
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        residenceId: residence._id,
        description: "Gás de cozinha",
        value: 125.0,
        payerId: user1.id,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.description).toBe("Gás de cozinha");
    expect(body.value).toBe(125.0);
  });
});
