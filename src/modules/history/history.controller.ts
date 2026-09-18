import type { FastifyReply, FastifyRequest } from "fastify";
import { historyService } from "./history.service.js";
import { historyQuerySchema } from "./history.schema.js";

type HistoryRouteParams = {
  residenceId?: string;
  id?: string;
};

export const historyController = {
  async getHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as HistoryRouteParams;
    const residenceId = params.residenceId || params.id || "";
    const query = historyQuerySchema.parse(request.query);

    const history = await historyService.getHistory(residenceId, query);
    return reply.status(200).send(history);
  },
};
