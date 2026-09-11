import { ResidenceModel } from "../residences/residence.model.js";
import { ExpenseModel } from "../expenses/expense.model.js";
import { TaskModel } from "../tasks/task.model.js";
import { NotFoundError } from "../../shared/errors/AppError.js";
import type { SummaryReportQuery } from "./report.schema.js";

export const reportService = {
  async getSummaryReport(residenceId: string, query: SummaryReportQuery = {}) {
    const residence = await ResidenceModel.findById(residenceId).populate("members", "name email");
    if (!residence) {
      throw new NotFoundError("Residência não encontrada");
    }

    const rawStart = query.startDate || query.dateFrom;
    const rawEnd = query.endDate || query.dateTo;

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

    const expenseDateQuery: Record<string, unknown> = {};
    if (startDate) expenseDateQuery.$gte = startDate;
    if (endDate) expenseDateQuery.$lte = endDate;

    const expenseFilter: Record<string, unknown> = { residenceId };
    if (startDate || endDate) {
      expenseFilter.date = expenseDateQuery;
    }

    const expenses = await ExpenseModel.find(expenseFilter);

    const taskDateQuery: Record<string, unknown> = {};
    if (startDate) taskDateQuery.$gte = startDate;
    if (endDate) taskDateQuery.$lte = endDate;

    const taskFilter: Record<string, unknown> = {
      residenceId,
      done: true,
    };

    if (startDate || endDate) {
      taskFilter.$or = [
        { lastCompletedAt: taskDateQuery },
        { updatedAt: taskDateQuery },
      ];
    }

    const completedTasks = await TaskModel.find(taskFilter);

    const members = (residence.members || []) as any[];
    const allMemberIds = members.map((m) => m._id.toString());

    let totalExpenses = 0;
    for (const exp of expenses) {
      totalExpenses += exp.value;
    }

    const membersReport = members.map((member) => {
      const memberId = member._id.toString();

      // Total pago pelo membro nas despesas do período
      const totalExpensesPaid = expenses
        .filter((e) => e.payerId?.toString() === memberId)
        .reduce((sum, e) => sum + e.value, 0);

      // Cota devida pelo membro no rateio
      const totalExpensesShare = expenses.reduce((sum, e) => {
        const participantIds =
          e.participantIds && e.participantIds.length > 0
            ? e.participantIds.map((p: any) => p.toString())
            : allMemberIds;

        if (!participantIds.includes(memberId)) return sum;
        return sum + e.value / participantIds.length;
      }, 0);

      // Total de tarefas concluídas atribuídas a esse membro no período
      const completedTasksCount = completedTasks.filter(
        (t) => t.assigneeId?.toString() === memberId
      ).length;

      return {
        resident: {
          id: memberId,
          name: member.name,
          email: member.email,
        },
        totalExpensesPaid,
        totalExpensesShare,
        completedTasksCount,
      };
    });

    return {
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
      },
      totalExpenses,
      totalCompletedTasks: completedTasks.length,
      membersReport,
    };
  },
};
