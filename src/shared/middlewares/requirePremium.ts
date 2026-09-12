import type { FastifyReply, FastifyRequest } from "fastify";
import { ForbiddenError, NotFoundError } from "../errors/AppError.js";
import { ResidenceModel } from "../../modules/residences/residence.model.js";

/**
 * Garante que a residência possui o plano Premium ativo.
 * Se request.residence já foi anexado por requireMembership, reutiliza.
 * Caso contrário, consulta a residência pelo residenceId dos parâmetros.
 */
export async function requirePremium(request: FastifyRequest, _reply: FastifyReply) {
  let residence = request.residence;

  if (!residence) {
    const { residenceId } = request.params as { residenceId?: string };
    if (!residenceId) {
      throw new NotFoundError("Residência não encontrada");
    }
    const found = await ResidenceModel.findById(residenceId);
    if (!found) {
      throw new NotFoundError("Residência não encontrada");
    }
    residence = found;
    request.residence = found;
  }

  if (residence.plan !== "premium") {
    throw new ForbiddenError("Recurso exclusivo para repúblicas no plano Premium");
  }
}
