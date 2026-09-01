/**
 * Lógica de recorrência de tarefas, portada de forma equivalente ao protótipo mobile
 * (src/services/recurrenceService.js do RepublicApp) para manter o mesmo comportamento
 * de reset/projeção entre cliente e servidor.
 */

export type Recurrence = "Única" | "Diária" | "Semanal" | "Mensal";

export interface RecurringTaskLike {
  id: string;
  title: string;
  assigneeId: string | null;
  recurrence: Recurrence;
  done: boolean;
  lastCompletedAt: Date | null;
  nextDueDate: Date | null;
}

export function calculateNextDueDate(recurrence: Recurrence, fromDate: Date = new Date()): Date | null {
  const date = new Date(fromDate);

  switch (recurrence) {
    case "Diária":
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
      return date;
    case "Semanal":
      date.setDate(date.getDate() + 7);
      date.setHours(0, 0, 0, 0);
      return date;
    case "Mensal":
      date.setMonth(date.getMonth() + 1);
      date.setHours(0, 0, 0, 0);
      return date;
    case "Única":
    default:
      return null;
  }
}

export function shouldResetTask(task: RecurringTaskLike, now: Date = new Date()): boolean {
  if (!task.done || !task.recurrence || task.recurrence === "Única") {
    return false;
  }

  if (task.nextDueDate && now >= task.nextDueDate) {
    return true;
  }

  if (!task.lastCompletedAt) {
    return false;
  }

  const completedDate = task.lastCompletedAt;
  const diffDays = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);

  switch (task.recurrence) {
    case "Diária":
      return completedDate.getDate() !== now.getDate() || diffDays >= 1;
    case "Semanal":
      return diffDays >= 7;
    case "Mensal":
      return completedDate.getMonth() !== now.getMonth() || diffDays >= 30;
    default:
      return false;
  }
}

function startOfDayMs(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getUpcomingOccurrences(
  tasks: RecurringTaskLike[],
  options: { horizonDays?: number; occurrencesPerTask?: number; now?: Date } = {}
) {
  const { horizonDays = 30, occurrencesPerTask = 6, now = new Date() } = options;
  const horizonMs = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  const today = startOfDayMs(now);
  const occurrences: { taskId: string; title: string; assigneeId: string | null; recurrence: Recurrence; date: Date }[] = [];

  for (const task of tasks) {
    if (!task.recurrence || task.recurrence === "Única") continue;

    let anchor = task.nextDueDate ?? calculateNextDueDate(task.recurrence, now);
    if (!anchor) continue;

    let isFirst = true;
    let pushed = 0;
    while (pushed < occurrencesPerTask && anchor.getTime() <= horizonMs) {
      if (isFirst || startOfDayMs(anchor) > today) {
        occurrences.push({
          taskId: task.id,
          title: task.title,
          assigneeId: task.assigneeId,
          recurrence: task.recurrence,
          date: anchor,
        });
        pushed += 1;
        isFirst = false;
      }
      const next = calculateNextDueDate(task.recurrence, anchor);
      if (!next) break;
      anchor = next;
    }
  }

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  return occurrences;
}
