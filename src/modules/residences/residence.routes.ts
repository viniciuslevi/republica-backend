import type { FastifyPluginAsync } from "fastify";
import { residenceController } from "./residence.controller.js";
import { requireMembership } from "../../shared/middlewares/requireMembership.js";
import { taskRoutes } from "../tasks/task.routes.js";
import { expenseRoutes } from "../expenses/expense.routes.js";
import { expenseController } from "../expenses/expense.controller.js";
import { reportRoutes } from "../reports/report.routes.js";
import { shoppingRoutes } from "../shopping/shopping.routes.js";

export const residenceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/", residenceController.create);
  app.post("/join", residenceController.join);
  app.get("/", residenceController.listMine);

  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireMembership);

    scoped.get("/:residenceId", residenceController.getOne);
    scoped.patch("/:residenceId/plan", residenceController.updatePlan);
    scoped.delete("/:residenceId/members/:memberId", residenceController.removeMember);
    scoped.get("/:residenceId/balances", expenseController.getBalances);

    scoped.register(taskRoutes, { prefix: "/:residenceId/tasks" });
    scoped.register(expenseRoutes, { prefix: "/:residenceId/expenses" });
    scoped.register(reportRoutes, { prefix: "/:residenceId/reports" });
    scoped.register(shoppingRoutes, { prefix: "/:residenceId/shopping-items" });
  });
};
