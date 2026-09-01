import type { FastifyReply, FastifyRequest } from "fastify";
import { ResidenceModel } from "../../modules/residences/residence.model.js";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors/AppError.js";

declare module "fastify" {
  interface FastifyRequest {
    residence?: InstanceType<typeof ResidenceModel>;
  }
}

/**
 * Garante que o usuário autenticado é membro da residência da rota (:residenceId)
 * e anexa o documento da residência em request.residence para reuso nos controllers.
 */
export async function requireMembership(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.user) {
    throw new UnauthorizedError();
  }

  const { residenceId } = request.params as { residenceId?: string };
  if (!residenceId) {
    throw new NotFoundError("Residência não encontrada");
  }

  const residence = await ResidenceModel.findById(residenceId);
  if (!residence) {
    throw new NotFoundError("Residência não encontrada");
  }

  const isMember = residence.members.some((memberId) => memberId.toString() === request.user!.sub);
  if (!isMember) {
    throw new ForbiddenError("Você não pertence a esta residência");
  }

  request.residence = residence;
}
