import { z } from "zod";

const recurrenceEnum = z.enum(["Única", "Diária", "Semanal", "Mensal"]);
const priorityEnum = z.enum(["Baixa", "Média", "Alta"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da tarefa"),
  description: z.string().trim().optional(),
  assigneeId: z.string().trim().nullable().optional(),
  recurrence: recurrenceEnum.optional(),
  priority: priorityEnum.optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const upcomingOccurrencesQuerySchema = z.object({
  horizonDays: z.coerce.number().int().positive().max(365).optional(),
  occurrencesPerTask: z.coerce.number().int().positive().max(50).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
