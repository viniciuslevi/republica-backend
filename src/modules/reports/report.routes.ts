import type { FastifyPluginAsync } from "fastify";
import { reportController } from "./report.controller.js";
import { requirePremium } from "../../shared/middlewares/requirePremium.js";

export const reportRoutes: FastifyPluginAsync = async (app) => {
  // A guarda de acesso garante que apenas repúblicas com plano premium acessam relatórios
  app.addHook("preHandler", requirePremium);

  app.get("/summary", reportController.getSummary);
  app.get("/", reportController.getSummary);
};
