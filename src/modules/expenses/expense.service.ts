import { ExpenseModel } from "./expense.model.js";
import { ResidenceModel } from "../residences/residence.model.js";
import type { CreateExpenseInput } from "./expense.schema.js";
import { NotFoundError } from "../../shared/errors/AppError.js";

export const expenseService = {
  async list(residenceId: string) {
    return ExpenseModel.find({ residenceId }).sort({ createdAt: -1 });
  },

  async create(residenceId: string, input: CreateExpenseInput) {
    return ExpenseModel.create({
      residenceId,
      description: input.description,
      value: input.value,
      payerId: input.payerId,
      participantIds: input.participantIds,
    });
  },

  async remove(residenceId: string, expenseId: string) {
    const result = await ExpenseModel.deleteOne({ _id: expenseId, residenceId });
    if (result.deletedCount === 0) {
      throw new NotFoundError("Despesa não encontrada");
    }
  },

  /**
   * Resumo meramente informativo de saldos: quanto cada morador pagou vs. sua cota
   * proporcional (despesa dividida igualmente entre os participantes de cada lançamento).
   * Sem integração bancária ou cobrança — só para visualização (requisito 5 do MVP).
   */
  async summary(residenceId: string) {
    const residence = await ResidenceModel.findById(residenceId).populate<{
      members: { _id: string; name: string; email: string }[];
    }>("members", "name email");
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    const expenses = await ExpenseModel.find({ residenceId });

    const paidByMember = new Map<string, number>();
    const shareByMember = new Map<string, number>();
    let totalExpenses = 0;

    for (const expense of expenses) {
      totalExpenses += expense.value;

      const payerId = expense.payerId.toString();
      paidByMember.set(payerId, (paidByMember.get(payerId) ?? 0) + expense.value);

      const share = expense.value / expense.participantIds.length;
      for (const participantId of expense.participantIds) {
        const key = participantId.toString();
        shareByMember.set(key, (shareByMember.get(key) ?? 0) + share);
      }
    }

    const balances = residence.members.map((member) => {
      const paid = paidByMember.get(member._id.toString()) ?? 0;
      const share = shareByMember.get(member._id.toString()) ?? 0;
      return {
        resident: { id: member._id.toString(), name: member.name, email: member.email },
        paid,
        share,
        balance: paid - share,
      };
    });

    return { totalExpenses, balances };
  },
};
