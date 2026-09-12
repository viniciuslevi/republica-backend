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

describe("Regra de Limite de Membros por Plano (SCRUM-100)", () => {
  async function registerUser(name: string, email: string) {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name, email, password: "password123" },
    });
    return res.json();
  }

  it("permite a entrada de novos moradores enquanto o limite de 6 membros no plano free não for atingido", async () => {
    const admin = await registerUser("Admin", "admin@rep.com");
    const createRes = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { name: "República Estudantil" },
    });
    const residence = createRes.json();
    expect(createRes.statusCode).toBe(201);
    expect(residence.members).toHaveLength(1);

    const user2 = await registerUser("User 2", "user2@rep.com");
    const joinRes2 = await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${user2.accessToken}` },
      payload: { code: residence.code },
    });
    expect(joinRes2.statusCode).toBe(200);
    expect(joinRes2.json().members).toHaveLength(2);
  });

  it("bloqueia a entrada com HTTP 403 ao atingir o limite de 6 membros no plano free", async () => {
    const admin = await registerUser("Admin", "admin@rep.com");
    const createRes = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { name: "República Cheia" },
    });
    const residence = createRes.json();

    for (let i = 2; i <= 6; i++) {
      const user = await registerUser(`User ${i}`, `user${i}@rep.com`);
      const joinRes = await app.inject({
        method: "POST",
        url: "/residences/join",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { code: residence.code },
      });
      expect(joinRes.statusCode).toBe(200);
    }

    const user7 = await registerUser("User 7", "user7@rep.com");
    const joinRes7 = await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${user7.accessToken}` },
      payload: { code: residence.code },
    });

    expect(joinRes7.statusCode).toBe(403);
    const body = joinRes7.json();
    expect(body.error).toMatch(/limite de 6 moradores do plano gratuito/i);
    expect(body.error).toMatch(/Premium/i);
  });

  it("mantém a idempotência: quem já é membro pode enviar o código mesmo com 6 membros", async () => {
    const admin = await registerUser("Admin", "admin@rep.com");
    const createRes = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { name: "República Idempotente" },
    });
    const residence = createRes.json();

    for (let i = 2; i <= 6; i++) {
      const user = await registerUser(`User ${i}`, `user${i}@rep.com`);
      await app.inject({
        method: "POST",
        url: "/residences/join",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { code: residence.code },
      });
    }

    const adminJoinAgain = await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { code: residence.code },
    });

    expect(adminJoinAgain.statusCode).toBe(200);
    expect(adminJoinAgain.json().members).toHaveLength(6);
  });

  it("permite entrada sem limite de membros quando a residência está no plano Premium", async () => {
    const admin = await registerUser("Admin", "admin@rep.com");
    const createRes = await app.inject({
      method: "POST",
      url: "/residences",
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { name: "República Mansão Premium" },
    });
    const residence = createRes.json();

    const upgradeRes = await app.inject({
      method: "PATCH",
      url: `/residences/${residence._id}/plan`,
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { plan: "premium" },
    });
    expect(upgradeRes.statusCode).toBe(200);
    expect(upgradeRes.json().plan).toBe("premium");

    for (let i = 2; i <= 6; i++) {
      const user = await registerUser(`User ${i}`, `user${i}@rep.com`);
      const joinRes = await app.inject({
        method: "POST",
        url: "/residences/join",
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { code: residence.code },
      });
      expect(joinRes.statusCode).toBe(200);
    }

    const user7 = await registerUser("User 7", "user7@rep.com");
    const joinRes7 = await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${user7.accessToken}` },
      payload: { code: residence.code },
    });
    expect(joinRes7.statusCode).toBe(200);
    expect(joinRes7.json().members).toHaveLength(7);

    const user8 = await registerUser("User 8", "user8@rep.com");
    const joinRes8 = await app.inject({
      method: "POST",
      url: "/residences/join",
      headers: { authorization: `Bearer ${user8.accessToken}` },
      payload: { code: residence.code },
    });
    expect(joinRes8.statusCode).toBe(200);
    expect(joinRes8.json().members).toHaveLength(8);
  });
});
