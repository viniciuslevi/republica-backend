import { ResidenceModel } from "./residence.model.js";
import { TaskModel } from "../tasks/task.model.js";
import type { CreateResidenceInput } from "./residence.schema.js";
import { AppError, ForbiddenError, NotFoundError, ConflictError } from "../../shared/errors/AppError.js";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `REP-${suffix}`;
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const existing = await ResidenceModel.findOne({ code });
    if (!existing) return code;
  }
  throw new ConflictError("Não foi possível gerar um código de convite único, tente novamente");
}

export const residenceService = {
  async create(userId: string, input: CreateResidenceInput) {
    const code = await generateUniqueInviteCode();
    const residence = await ResidenceModel.create({
      name: input.name,
      address: input.address,
      description: input.description,
      adminId: userId,
      members: [userId],
      code,
    });
    return residence;
  },

  async joinByCode(userId: string, code: string) {
    const residence = await ResidenceModel.findOne({ code: code.trim().toUpperCase() });
    if (!residence) {
      throw new NotFoundError("Código de convite inválido");
    }

    const alreadyMember = residence.members.some((memberId) => memberId.toString() === userId);
    if (!alreadyMember) {
      residence.members.push(userId as unknown as (typeof residence.members)[number]);
      await residence.save();
    }

    return residence;
  },

  async listForUser(userId: string) {
    return ResidenceModel.find({ members: userId }).sort({ createdAt: -1 });
  },

  async getById(residenceId: string) {
    const residence = await ResidenceModel.findById(residenceId).populate("members", "name email");
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }
    return residence;
  },

  /**
   * Remove um morador da residência. Só o admin pode remover, o admin não pode remover
   * a si mesmo e o último morador nunca pode ser removido. Tarefas atribuídas ao morador
   * removido ficam sem responsável (assigneeId=null), igual ao protótipo mobile.
   */
  async removeMember(residenceId: string, requesterId: string, memberId: string) {
    const residence = await ResidenceModel.findById(residenceId);
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    if (residence.adminId.toString() !== requesterId) {
      throw new ForbiddenError("Apenas o administrador da república pode remover moradores");
    }

    if (residence.adminId.toString() === memberId) {
      throw new AppError("O administrador da república não pode ser removido", 400);
    }

    if (residence.members.length <= 1) {
      throw new AppError("Não é possível remover o último morador da república", 400);
    }

    const wasMember = residence.members.some((id) => id.toString() === memberId);
    if (!wasMember) {
      throw new NotFoundError("Morador não encontrado nesta residência");
    }

    residence.members = residence.members.filter(
      (id) => id.toString() !== memberId
    ) as typeof residence.members;
    await residence.save();

    await TaskModel.updateMany({ residenceId, assigneeId: memberId }, { assigneeId: null });

    return residence;
  },

  async updatePlan(residenceId: string, requesterId: string, plan: "free" | "premium") {
    const residence = await ResidenceModel.findById(residenceId);
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    if (residence.adminId.toString() !== requesterId) {
      throw new ForbiddenError("Apenas o administrador da república pode alterar o plano");
    }

    residence.plan = plan;
    await residence.save();
    return residence;
  },
};
