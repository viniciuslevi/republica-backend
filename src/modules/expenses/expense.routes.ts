import type { FastifyPluginAsync } from "fastify";
import { expenseController } from "./expense.controller.js";

export const expenseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", expenseController.list);
  app.post("/", expenseController.create);
  app.get("/summary", expenseController.summary);
  app.delete("/:expenseId", expenseController.remove);
};
