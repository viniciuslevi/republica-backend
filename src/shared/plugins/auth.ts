import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, type AuthTokenPayload } from "../security/tokens.js";
import { UnauthorizedError } from "../errors/AppError.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthTokenPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      throw new UnauthorizedError("Token de acesso ausente");
    }

    try {
      request.user = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Token inválido ou expirado");
    }
  });
};

export default fp(authPlugin);
