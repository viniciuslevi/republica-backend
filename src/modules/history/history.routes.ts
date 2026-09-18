import type { FastifyPluginAsync } from "fastify";
import { historyController } from "./history.controller.js";

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", historyController.getHistory);
};
