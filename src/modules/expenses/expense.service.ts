import { ExpenseModel } from "./expense.model.js";
import type { CreateExpenseInput } from "./expense.schema.js";
import { ResidenceModel } from "../residences/residence.model.js";
import { AppError, NotFoundError } from "../../shared/errors/AppError.js";

export const expenseService = {
  async list(residenceId: string) {
    return ExpenseModel.find({ residenceId }).sort({ createdAt: -1 });
  },

  async create(residenceId: string, input: CreateExpenseInput) {
    const residence = await ResidenceModel.findById(residenceId);
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    const memberIdStrings = residence.members.map((m) => m.toString());

    // Validar se o pagador pertence à residência
    if (!memberIdStrings.includes(input.payerId)) {
      throw new AppError("O pagador deve ser um morador da residência", 400);
    }

    // Definir participantes: se não fornecido ou vazio, divide entre todos os membros da residência
    let participantIds = input.participantIds;
    if (!participantIds || participantIds.length === 0) {
      participantIds = memberIdStrings;
    } else {
      // Validar se todos os participantes pertencem à residência
      for (const pId of participantIds) {
        if (!memberIdStrings.includes(pId)) {
          throw new AppError(`O participante selecionado não é morador da residência: ${pId}`, 400);
        }
      }
    }

    const expense = await ExpenseModel.create({
      residenceId,
      description: input.description,
      value: input.value,
      payerId: input.payerId,
      participantIds,
      date: input.date || new Date(),
    });

    return expense;
  },

  async remove(residenceId: string, expenseId: string) {
    const expense = await ExpenseModel.findOneAndDelete({ _id: expenseId, residenceId });
    if (!expense) {
      throw new NotFoundError("Despesa não encontrada");
    }
  },

  async getBalances(residenceId: string) {
    const residence = await ResidenceModel.findById(residenceId).populate("members", "name email");
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    const expenses = await ExpenseModel.find({ residenceId });
    if (expenses.length === 0) {
      return { totalExpenses: 0, balances: [] };
    }

    const allMemberIds = residence.members.map((m: any) => m._id.toString());
    const totalExpenses = round2(expenses.reduce((sum, e) => sum + e.value, 0));

    const balances = (residence.members as any[]).map((member) => {
      const mId = member._id.toString();

      const paid = round2(
        expenses
          .filter((e) => e.payerId.toString() === mId)
          .reduce((sum, e) => sum + e.value, 0)
      );

      const share = round2(
        expenses.reduce((sum, e) => {
          const participantIds =
            e.participantIds && e.participantIds.length > 0
              ? e.participantIds.map((p: any) => p.toString())
              : allMemberIds;
          if (!participantIds.includes(mId)) return sum;
          return sum + e.value / participantIds.length;
        }, 0)
      );

      const balance = round2(paid - share);

      return {
        resident: {
          id: mId,
          name: member.name,
          email: member.email,
        },
        paid,
        share,
        balance,
      };
    });

    return { totalExpenses, balances };
  },
};

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
