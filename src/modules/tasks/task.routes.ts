import type { FastifyPluginAsync } from "fastify";
import { taskController } from "./task.controller.js";

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", taskController.list);
  app.post("/", taskController.create);
  app.get("/upcoming-occurrences", taskController.upcoming);
  app.patch("/:taskId", taskController.update);
  app.delete("/:taskId", taskController.remove);
  app.post("/:taskId/complete", taskController.complete);
  app.post("/:taskId/reopen", taskController.reopen);
};
