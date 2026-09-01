import type { FastifyPluginAsync } from "fastify";
import { residenceController } from "./residence.controller.js";
import { requireMembership } from "../../shared/middlewares/requireMembership.js";
import { taskRoutes } from "../tasks/task.routes.js";
import { expenseRoutes } from "../expenses/expense.routes.js";
import { shoppingRoutes } from "../shopping/shopping.routes.js";

export const residenceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/", residenceController.create);
  app.post("/join", residenceController.join);
  app.get("/", residenceController.listMine);

  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireMembership);

    scoped.get("/:residenceId", residenceController.getOne);

    scoped.register(taskRoutes, { prefix: "/:residenceId/tasks" });
    scoped.register(expenseRoutes, { prefix: "/:residenceId/expenses" });
    scoped.register(shoppingRoutes, { prefix: "/:residenceId/shopping-items" });
  });
};
