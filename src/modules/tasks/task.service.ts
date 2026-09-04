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
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    weekDay: task.weekDay ?? null,
    monthDay: task.monthDay ?? null,
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
          nextDueDate: calculateNextDueDate(task.recurrence as RecurringTaskLike["recurrence"], now, {
            dueTime: task.dueTime,
            weekDay: task.weekDay,
            monthDay: task.monthDay,
            dueDate: task.dueDate,
          }),
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
            nextDueDate: calculateNextDueDate(task.recurrence as RecurringTaskLike["recurrence"], now, {
              dueTime: task.dueTime,
              weekDay: task.weekDay,
              monthDay: task.monthDay,
              dueDate: task.dueDate,
            }),
          }
        )
      )
    );

    return toReset.length;
  },

  async create(residenceId: string, input: CreateTaskInput) {
    const recurrence = input.recurrence ?? "Única";
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;
    const dueTime = input.dueTime ?? null;
    const weekDay = input.weekDay ?? null;
    const monthDay = input.monthDay ?? null;

    const nextDueDate = calculateNextDueDate(recurrence, new Date(), {
      dueTime,
      weekDay,
      monthDay,
      dueDate,
    });

    return TaskModel.create({
      residenceId,
      title: input.title,
      description: input.description ?? "",
      assigneeId: input.assigneeId ?? null,
      recurrence,
      priority: input.priority ?? "Média",
      dueDate,
      dueTime,
      weekDay,
      monthDay,
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
    if (input.recurrence !== undefined) task.recurrence = input.recurrence;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.dueTime !== undefined) task.dueTime = input.dueTime ?? null;
    if (input.weekDay !== undefined) task.weekDay = input.weekDay ?? null;
    if (input.monthDay !== undefined) task.monthDay = input.monthDay ?? null;

    if (
      input.recurrence !== undefined ||
      input.dueDate !== undefined ||
      input.dueTime !== undefined ||
      input.weekDay !== undefined ||
      input.monthDay !== undefined
    ) {
      task.nextDueDate = calculateNextDueDate(task.recurrence as RecurringTaskLike["recurrence"], new Date(), {
        dueTime: task.dueTime,
        weekDay: task.weekDay,
        monthDay: task.monthDay,
        dueDate: task.dueDate,
      });
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
