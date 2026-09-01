import type { FastifyPluginAsync } from "fastify";
import { shoppingController } from "./shopping.controller.js";

export const shoppingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", shoppingController.list);
  app.post("/", shoppingController.create);
  app.patch("/:itemId", shoppingController.update);
  app.delete("/:itemId", shoppingController.remove);
};
