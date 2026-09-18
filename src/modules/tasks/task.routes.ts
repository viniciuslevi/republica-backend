import type { FastifyPluginAsync } from "fastify";
import { taskController } from "./task.controller.js";
import { requirePremium } from "../../shared/middlewares/requirePremium.js";

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", taskController.list);
  app.post("/", taskController.create);
  app.get("/upcoming-occurrences", taskController.upcoming);
  // Automação de lembretes é recurso premium (SCRUM-27) — demais rotas de tarefas ficam livres.
  app.get("/reminders", { preHandler: requirePremium }, taskController.reminders);
  app.patch("/:taskId", taskController.update);
  app.patch("/:taskId/status", taskController.updateStatus);
  app.delete("/:taskId", taskController.remove);
  app.post("/:taskId/complete", taskController.complete);
  app.post("/:taskId/reopen", taskController.reopen);
};
