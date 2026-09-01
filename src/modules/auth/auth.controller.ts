import type { FastifyReply, FastifyRequest } from "fastify";
import { authService } from "./auth.service.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema.js";

export const authController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    return reply.status(201).send(result);
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input);
    return reply.status(200).send(result);
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const input = refreshSchema.parse(request.body);
    const result = await authService.refresh(input.refreshToken);
    return reply.status(200).send(result);
  },
};
