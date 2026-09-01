import type { FastifyReply, FastifyRequest } from "fastify";
import { shoppingService } from "./shopping.service.js";
import { createShoppingItemSchema, updateShoppingItemSchema } from "./shopping.schema.js";

type ResidenceParams = { residenceId: string };
type ItemParams = ResidenceParams & { itemId: string };

export const shoppingController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const items = await shoppingService.list(residenceId);
    return reply.status(200).send(items);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const input = createShoppingItemSchema.parse(request.body);
    const item = await shoppingService.create(residenceId, request.user!.sub, input);
    return reply.status(201).send(item);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, itemId } = request.params as ItemParams;
    const input = updateShoppingItemSchema.parse(request.body);
    const item = await shoppingService.update(residenceId, itemId, input);
    return reply.status(200).send(item);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, itemId } = request.params as ItemParams;
    await shoppingService.remove(residenceId, itemId);
    return reply.status(204).send();
  },
};
