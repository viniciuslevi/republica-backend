/**
 * Lógica de recorrência de tarefas, portada de forma equivalente ao protótipo mobile
 * (src/services/recurrenceService.js do RepublicApp) para manter o mesmo comportamento
 * de reset/projeção entre cliente e servidor.
 */

export type Recurrence = "Única" | "Diária" | "Semanal" | "Mensal";

export interface TaskScheduleDetails {
  dueTime?: string | null;
  weekDay?: number | null;
  monthDay?: number | null;
  dueDate?: Date | string | null;
}

export interface RecurringTaskLike {
  id: string;
  title: string;
  assigneeId: string | null;
  recurrence: Recurrence;
  done: boolean;
  lastCompletedAt: Date | null;
  nextDueDate: Date | null;
  dueDate?: Date | null;
  dueTime?: string | null;
  weekDay?: number | null;
  monthDay?: number | null;
}

function parseDueTime(dueTime?: string | null): { hours: number; minutes: number } | null {
  if (!dueTime) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(dueTime.trim());
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function clampDayOfMonth(year: number, month: number, day: number): number {
  const maxDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), maxDay);
}

function parseDateParts(dueDate: Date | string): { year: number; month: number; day: number } | null {
  if (dueDate instanceof Date) {
    if (isNaN(dueDate.getTime())) return null;
    return { year: dueDate.getFullYear(), month: dueDate.getMonth(), day: dueDate.getDate() };
  }
  if (typeof dueDate === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate.trim());
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
      };
    }
    const d = new Date(dueDate);
    if (isNaN(d.getTime())) return null;
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  return null;
}

export function calculateNextDueDate(
  recurrence: Recurrence,
  fromDate: Date = new Date(),
  details?: TaskScheduleDetails
): Date | null {
  const date = new Date(fromDate);
  const time = parseDueTime(details?.dueTime);
  const h = time ? time.hours : 0;
  const m = time ? time.minutes : 0;

  switch (recurrence) {
    case "Diária": {
      const target = new Date(date);
      target.setHours(h, m, 0, 0);
      if (time && target.getTime() > date.getTime()) {
        return target;
      }
      target.setDate(target.getDate() + 1);
      return target;
    }
    case "Semanal": {
      const target = new Date(date);
      target.setHours(h, m, 0, 0);

      if (details?.weekDay != null) {
        const desiredDay = details.weekDay; // 0=Domingo, 1=Segunda, ..., 6=Sábado
        let diff = (desiredDay - date.getDay() + 7) % 7;
        if (diff === 0 && target.getTime() <= date.getTime()) {
          diff = 7;
        }
        target.setDate(target.getDate() + diff);
        return target;
      }

      target.setDate(target.getDate() + 7);
      return target;
    }
    case "Mensal": {
      const target = new Date(date);
      target.setHours(h, m, 0, 0);

      if (details?.monthDay != null) {
        const desiredDay = details.monthDay;
        const currentYear = target.getFullYear();
        const currentMonth = target.getMonth();
        const dayThisMonth = clampDayOfMonth(currentYear, currentMonth, desiredDay);

        target.setDate(dayThisMonth);
        if (target.getTime() <= date.getTime()) {
          const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
          const nextYear = nextMonthDate.getFullYear();
          const nextMonth = nextMonthDate.getMonth();
          const dayNextMonth = clampDayOfMonth(nextYear, nextMonth, desiredDay);
          target.setFullYear(nextYear, nextMonth, dayNextMonth);
        }
        return target;
      }

      target.setMonth(target.getMonth() + 1);
      return target;
    }
    case "Única": {
      if (details?.dueDate) {
        const parts = parseDateParts(details.dueDate);
        if (parts) {
          return new Date(parts.year, parts.month, parts.day, h, m, 0, 0);
        }
      }
      return null;
    }
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

    const scheduleDetails: TaskScheduleDetails = {
      dueTime: task.dueTime,
      weekDay: task.weekDay,
      monthDay: task.monthDay,
      dueDate: task.dueDate,
    };

    let anchor = task.nextDueDate ?? calculateNextDueDate(task.recurrence, now, scheduleDetails);
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
      const next = calculateNextDueDate(task.recurrence, anchor, scheduleDetails);
      if (!next) break;
      anchor = next;
    }
  }

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  return occurrences;
}
