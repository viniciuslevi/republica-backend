import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Dados inválidos",
        issues: error.flatten().fieldErrors,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    if (error.validation) {
      return reply.status(400).send({ error: "Dados inválidos", issues: error.validation });
    }

    app.log.error(error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: "Rota não encontrada" });
  });
}
