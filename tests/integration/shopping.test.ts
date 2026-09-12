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

describe("módulo de lista de compras (shopping-items)", () => {
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

    await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${token2}` },
      payload: { code: residence.code },
    });

    return { user1, token1, user2, token2, residence };
  }

  it("adiciona um item com nome e quantidade (HTTP 201)", async () => {
    const { token1, user1, residence } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "Detergente", quantity: "2 unidades" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe("Detergente");
    expect(body.quantity).toBe("2 unidades");
    expect(body.purchased).toBe(false);
    expect(body.addedById).toBe(user1.id);
    expect(body.residenceId).toBe(residence._id);
  });

  it("bloqueia nome vazio (HTTP 400)", async () => {
    const { token1, residence } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "   " },
    });

    expect(response.statusCode).toBe(400);
  });

  it("item adicionado aparece para todos os membros do grupo (GET /residences/:id/shopping-items)", async () => {
    const { token1, token2, residence } = await setupResidenceWithTwoMembers();

    await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "Arroz" },
    });

    const listResponse = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token2}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const items = listResponse.json();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Arroz");
  });

  it("marca um item como comprado e permite reverter o status (PATCH .../purchased)", async () => {
    const { token1, residence } = await setupResidenceWithTwoMembers();

    const created = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "Sabão em pó" },
    });
    const itemId = created.json()._id;

    const markResponse = await app.inject({
      method: "PATCH",
      url: `/residences/${residence._id}/shopping-items/${itemId}/purchased`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {},
    });
    expect(markResponse.statusCode).toBe(200);
    expect(markResponse.json().purchased).toBe(true);

    const revertResponse = await app.inject({
      method: "PATCH",
      url: `/residences/${residence._id}/shopping-items/${itemId}/purchased`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { purchased: false },
    });
    expect(revertResponse.statusCode).toBe(200);
    expect(revertResponse.json().purchased).toBe(false);
  });

  it("retorna 404 ao marcar item inexistente como comprado", async () => {
    const { token1, residence } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "PATCH",
      url: `/residences/${residence._id}/shopping-items/${new mongoose.Types.ObjectId()}/purchased`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {},
    });

    expect(response.statusCode).toBe(404);
  });

  it("remove um item da lista (HTTP 204) e ele deixa de aparecer na listagem", async () => {
    const { token1, residence } = await setupResidenceWithTwoMembers();

    const created = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: "Papel higiênico" },
    });
    const itemId = created.json()._id;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/residences/${residence._id}/shopping-items/${itemId}`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const listResponse = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(listResponse.json()).toHaveLength(0);
  });

  it("impede acesso de usuário que não é membro da residência (HTTP 403)", async () => {
    const { residence } = await setupResidenceWithTwoMembers();

    const outsiderRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Intruso", email: "intruso@republica.com", password: "123456" },
    });
    const outsiderToken = outsiderRegister.json().accessToken;

    const response = await app.inject({
      method: "POST",
      url: `/residences/${residence._id}/shopping-items`,
      headers: { authorization: `Bearer ${outsiderToken}` },
      payload: { name: "Item indevido" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("bloqueia acesso sem autenticação (HTTP 401)", async () => {
    const { residence } = await setupResidenceWithTwoMembers();

    const response = await app.inject({
      method: "GET",
      url: `/residences/${residence._id}/shopping-items`,
    });

    expect(response.statusCode).toBe(401);
  });
});
