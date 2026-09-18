import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./shared/config/env.js";
import { registerErrorHandler } from "./shared/plugins/errorHandler.js";
import authPlugin from "./shared/plugins/auth.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { residenceRoutes } from "./modules/residences/residence.routes.js";
import { expenseController } from "./modules/expenses/expense.controller.js";

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
        : true,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await registerErrorHandler(app);
  await app.register(authPlugin);

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body: string, done) => {
      if (!body || body.trim() === "") {
        return done(null, {});
      }
      try {
        done(null, JSON.parse(body));
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(residenceRoutes, { prefix: "/residences" });

  await app.register(async (expenseApp) => {
    expenseApp.addHook("onRequest", expenseApp.authenticate);
    expenseApp.post("/expenses", expenseController.createTopLevel);
  });

  return app;
}
