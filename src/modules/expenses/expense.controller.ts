import type { FastifyReply, FastifyRequest } from "fastify";
import { expenseService } from "./expense.service.js";
import { createExpenseSchema } from "./expense.schema.js";

type ResidenceParams = { residenceId: string };
type ExpenseParams = ResidenceParams & { expenseId: string };

export const expenseController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const expenses = await expenseService.list(residenceId);
    return reply.status(200).send(expenses);
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

  async summary(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const summary = await expenseService.summary(residenceId);
    return reply.status(200).send(summary);
  },
};
