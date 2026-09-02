import type { FastifyReply, FastifyRequest } from "fastify";
import { residenceService } from "./residence.service.js";
import { createResidenceSchema, joinResidenceSchema } from "./residence.schema.js";

export const residenceController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createResidenceSchema.parse(request.body);
    const residence = await residenceService.create(request.user!.sub, input);
    return reply.status(201).send(residence);
  },

  async join(request: FastifyRequest, reply: FastifyReply) {
    const input = joinResidenceSchema.parse(request.body);
    const residence = await residenceService.joinByCode(request.user!.sub, input.code);
    return reply.status(200).send(residence);
  },

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    const residences = await residenceService.listForUser(request.user!.sub);
    return reply.status(200).send(residences);
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send(request.residence);
  },

  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, memberId } = request.params as { residenceId: string; memberId: string };
    const residence = await residenceService.removeMember(residenceId, request.user!.sub, memberId);
    return reply.status(200).send(residence);
  },
};
