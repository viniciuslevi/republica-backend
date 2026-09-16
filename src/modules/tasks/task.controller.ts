import type { FastifyReply, FastifyRequest } from "fastify";
import { taskService } from "./task.service.js";
import { createTaskSchema, updateTaskSchema, upcomingOccurrencesQuerySchema, remindersQuerySchema } from "./task.schema.js";

type ResidenceParams = { residenceId: string };
type TaskParams = ResidenceParams & { taskId: string };

export const taskController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const tasks = await taskService.list(residenceId);
    return reply.status(200).send(tasks);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const input = createTaskSchema.parse(request.body);
    const task = await taskService.create(residenceId, input);
    return reply.status(201).send(task);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, taskId } = request.params as TaskParams;
    const input = updateTaskSchema.parse(request.body);
    const task = await taskService.update(residenceId, taskId, input);
    return reply.status(200).send(task);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, taskId } = request.params as TaskParams;
    await taskService.remove(residenceId, taskId);
    return reply.status(204).send();
  },

  async complete(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, taskId } = request.params as TaskParams;
    const task = await taskService.setDone(residenceId, taskId, true);
    return reply.status(200).send(task);
  },

  async reopen(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId, taskId } = request.params as TaskParams;
    const task = await taskService.setDone(residenceId, taskId, false);
    return reply.status(200).send(task);
  },

  async upcoming(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const query = upcomingOccurrencesQuerySchema.parse(request.query);
    const occurrences = await taskService.upcomingOccurrences(residenceId, query);
    return reply.status(200).send(occurrences);
  },

  async reminders(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as ResidenceParams;
    const query = remindersQuerySchema.parse(request.query);
    const reminders = await taskService.getReminders(residenceId, query);
    return reply.status(200).send(reminders);
  },
};
