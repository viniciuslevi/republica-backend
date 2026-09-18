import { TaskModel } from "../tasks/task.model.js";
import { ExpenseModel } from "../expenses/expense.model.js";
import { ResidenceModel } from "../residences/residence.model.js";
import { NotFoundError } from "../../shared/errors/AppError.js";
import type { HistoryQuery } from "./history.schema.js";

export interface HistoryItem {
  id: string;
  originalId: string;
  type: "task" | "expense";
  title: string;
  description: string;
  detail?: string;
  date: string;
  personId: string | null;
  personName: string | null;
  responsible: {
    id: string;
    name: string;
    email: string;
  } | null;
  payer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  value?: number;
  priority?: string;
  recurrence?: string;
}

export const historyService = {
  async getHistory(residenceId: string, query: Partial<HistoryQuery> = {}): Promise<HistoryItem[]> {
    const residence = await ResidenceModel.findById(residenceId);
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    const type = query.type || "all";
    const rawStart = query.dateFrom || query.startDate;
    const rawEnd = query.dateTo || query.endDate;

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (rawStart) {
      const d = new Date(rawStart);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        startDate = d;
      }
    }

    if (rawEnd) {
      const d = new Date(rawEnd);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        endDate = d;
      }
    }

    const items: HistoryItem[] = [];

    // 1. Fetch completed tasks if type allows
    if (type === "all" || type === "task") {
      const taskFilter: Record<string, unknown> = {
        residenceId,
        done: true,
      };

      if (query.residentId) {
        taskFilter.assigneeId = query.residentId;
      }

      const tasks = await TaskModel.find(taskFilter)
        .populate("assigneeId", "name email")
        .lean();

      for (const t of tasks as any[]) {
        const completionDate = t.lastCompletedAt || t.updatedAt || t.createdAt;
        const d = new Date(completionDate);

        if (startDate && d < startDate) continue;
        if (endDate && d > endDate) continue;

        const assignee = t.assigneeId && typeof t.assigneeId === "object" ? t.assigneeId : null;
        const personId = assignee ? assignee._id.toString() : (t.assigneeId ? t.assigneeId.toString() : null);
        const personName = assignee ? assignee.name : null;

        items.push({
          id: `task_${t._id.toString()}`,
          originalId: t._id.toString(),
          type: "task",
          title: t.title,
          description: t.title,
          detail: t.description || "",
          date: d.toISOString(),
          personId,
          personName,
          responsible: assignee
            ? {
                id: assignee._id.toString(),
                name: assignee.name,
                email: assignee.email,
              }
            : null,
          priority: t.priority,
          recurrence: t.recurrence,
        });
      }
    }

    // 2. Fetch expenses if type allows
    if (type === "all" || type === "expense") {
      const expenseFilter: Record<string, unknown> = {
        residenceId,
      };

      if (query.residentId) {
        expenseFilter.payerId = query.residentId;
      }

      const expenses = await ExpenseModel.find(expenseFilter)
        .populate("payerId", "name email")
        .lean();

      for (const e of expenses as any[]) {
        const expenseDate = e.date || e.createdAt;
        const d = new Date(expenseDate);

        if (startDate && d < startDate) continue;
        if (endDate && d > endDate) continue;

        const payer = e.payerId && typeof e.payerId === "object" ? e.payerId : null;
        const personId = payer ? payer._id.toString() : (e.payerId ? e.payerId.toString() : null);
        const personName = payer ? payer.name : null;
        const residentObj = payer
          ? {
              id: payer._id.toString(),
              name: payer.name,
              email: payer.email,
            }
          : null;

        items.push({
          id: `expense_${e._id.toString()}`,
          originalId: e._id.toString(),
          type: "expense",
          title: e.description,
          description: e.description,
          value: e.value,
          date: d.toISOString(),
          personId,
          personName,
          responsible: residentObj,
          payer: residentObj,
        });
      }
    }

    // Sort chronologically descending (most recent first)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (query.limit && query.limit > 0) {
      return items.slice(0, query.limit);
    }

    return items;
  },
};
