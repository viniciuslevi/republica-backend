import { TaskModel, type TaskDocument } from "./task.model.js";
import type { CreateTaskInput, UpdateTaskInput } from "./task.schema.js";
import { NotFoundError } from "../../shared/errors/AppError.js";
import { calculateNextDueDate, getUpcomingOccurrences, shouldResetTask, type RecurringTaskLike } from "./recurrence.js";

function toRecurringTaskLike(task: TaskDocument): RecurringTaskLike {
  return {
    id: task.id,
    title: task.title,
    assigneeId: task.assigneeId ? task.assigneeId.toString() : null,
    recurrence: task.recurrence as RecurringTaskLike["recurrence"],
    done: task.done,
    lastCompletedAt: task.lastCompletedAt ?? null,
    nextDueDate: task.nextDueDate ?? null,
  };
}

/**
 * Reset "preguiçoso": toda vez que as tarefas de uma residência são lidas, tarefas
 * recorrentes concluídas cujo ciclo já expirou voltam para done=false. Complementado
 * por um job diário (ver shared/jobs/resetRecurringTasks.ts) para residências que
 * ninguém abriu no app.
 */
async function applyRecurrenceReset(residenceId: string, now: Date = new Date()) {
  const tasks = await TaskModel.find({ residenceId });

  const toReset = tasks.filter((task) => shouldResetTask(toRecurringTaskLike(task), now));
  if (toReset.length === 0) {
    return tasks;
  }

  await Promise.all(
    toReset.map((task) =>
      TaskModel.updateOne(
        { _id: task._id },
        {
          done: false,
          lastCompletedAt: null,
          nextDueDate: calculateNextDueDate(task.recurrence as RecurringTaskLike["recurrence"], now),
        }
      )
    )
  );

  return TaskModel.find({ residenceId });
}

export const taskService = {
  async list(residenceId: string) {
    return applyRecurrenceReset(residenceId);
  },

  /**
   * Reset em lote de todas as residências, usado pelo job diário (ver
   * shared/jobs/resetRecurringTasks.ts) para cobrir residências que ninguém abriu no app.
   */
  async resetAllOverdueTasks(now: Date = new Date()) {
    const tasks = await TaskModel.find({ done: true, recurrence: { $ne: "Única" } });
    const toReset = tasks.filter((task) => shouldResetTask(toRecurringTaskLike(task), now));

    await Promise.all(
      toReset.map((task) =>
        TaskModel.updateOne(
          { _id: task._id },
          {
            done: false,
            lastCompletedAt: null,
            nextDueDate: calculateNextDueDate(task.recurrence as RecurringTaskLike["recurrence"], now),
          }
        )
      )
    );

    return toReset.length;
  },

  async create(residenceId: string, input: CreateTaskInput) {
    const recurrence = input.recurrence ?? "Única";
    const nextDueDate = recurrence !== "Única" ? calculateNextDueDate(recurrence) : null;

    return TaskModel.create({
      residenceId,
      title: input.title,
      description: input.description ?? "",
      assigneeId: input.assigneeId ?? null,
      recurrence,
      priority: input.priority ?? "Média",
      nextDueDate,
    });
  },

  async update(residenceId: string, taskId: string, input: UpdateTaskInput) {
    const task = await TaskModel.findOne({ _id: taskId, residenceId });
    if (!task) {
      throw new NotFoundError("Tarefa não encontrada");
    }

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.assigneeId !== undefined) task.assigneeId = input.assigneeId as TaskDocument["assigneeId"];
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.recurrence !== undefined) {
      task.recurrence = input.recurrence;
      task.nextDueDate = input.recurrence !== "Única" ? calculateNextDueDate(input.recurrence) : null;
    }

    await task.save();
    return task;
  },

  async remove(residenceId: string, taskId: string) {
    const result = await TaskModel.deleteOne({ _id: taskId, residenceId });
    if (result.deletedCount === 0) {
      throw new NotFoundError("Tarefa não encontrada");
    }
  },

  async setDone(residenceId: string, taskId: string, done: boolean) {
    const task = await TaskModel.findOne({ _id: taskId, residenceId });
    if (!task) {
      throw new NotFoundError("Tarefa não encontrada");
    }

    task.done = done;
    task.lastCompletedAt = done ? new Date() : null;
    await task.save();
    return task;
  },

  async upcomingOccurrences(
    residenceId: string,
    options: { horizonDays?: number; occurrencesPerTask?: number } = {}
  ) {
    const tasks = await applyRecurrenceReset(residenceId);
    return getUpcomingOccurrences(tasks.map(toRecurringTaskLike), options);
  },
};
