import type { FastifyReply, FastifyRequest } from "fastify";
import { expenseService } from "./expense.service.js";
import { createExpenseSchema, createExpenseTopLevelSchema } from "./expense.schema.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ResidenceModel } from "../residences/residence.model.js";

type ResidenceParams = { residenceId: string };
type ExpenseParams = ResidenceParams & { expenseId: string };

export const expenseController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const expenses = await expenseService.list(residenceId);
    return reply.status(200).send(expenses);
  },

  async getBalances(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const result = await expenseService.getBalances(residenceId);
    return reply.status(200).send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const input = createExpenseSchema.parse(request.body);
    const expense = await expenseService.create(residenceId, input);
    return reply.status(201).send(expense);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, expenseId } = request.params as ExpenseParams;
    await expenseService.remove(residenceId, expenseId);
    return reply.status(204).send();
  },

  async createTopLevel(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.sub;
    const input = createExpenseTopLevelSchema.parse(request.body);

    let targetResidenceId = input.residenceId;
    if (!targetResidenceId) {
      const userResidences = await ResidenceModel.find({ members: userId });
      if (userResidences.length === 1 && userResidences[0]) {
        targetResidenceId = userResidences[0]._id.toString();
      } else if (userResidences.length === 0) {
        throw new AppError("Usuário não pertence a nenhuma residência", 400);
      } else {
        throw new AppError("Informe a residência no corpo da requisição (residenceId)", 400);
      }
    } else {
      const residence = await ResidenceModel.findById(targetResidenceId);
      if (!residence || !residence.members.some((m) => m.toString() === userId)) {
        return reply.status(403).send({ error: "Você não tem acesso a esta residência" });
      }
    }

    const expense = await expenseService.create(targetResidenceId, input);
    return reply.status(201).send(expense);
  },
};
