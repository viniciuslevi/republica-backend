import { z } from "zod";

const recurrenceEnum = z.enum(["Única", "Diária", "Semanal", "Mensal"]);
const priorityEnum = z.enum(["Baixa", "Média", "Alta"]);

const emptyToNull = (val: unknown) => (val === "" ? null : val);

const baseTaskSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da tarefa"),
  description: z.string().trim().optional(),
  assigneeId: z.string().trim().nullable().optional(),
  recurrence: recurrenceEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  dueTime: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horário deve estar no formato HH:mm")
      .nullable()
      .optional()
  ),
  weekDay: z.preprocess(
    emptyToNull,
    z
      .coerce
      .number()
      .int()
      .min(0, "Dia da semana inválido (0-6)")
      .max(6, "Dia da semana inválido (0-6)")
      .nullable()
      .optional()
  ),
  monthDay: z.preprocess(
    emptyToNull,
    z
      .coerce
      .number()
      .int()
      .min(1, "Dia do mês deve ser entre 1 e 31")
      .max(31, "Dia do mês deve ser entre 1 e 31")
      .nullable()
      .optional()
  ),
});

export const createTaskSchema = baseTaskSchema.superRefine((data, ctx) => {
  if (data.recurrence === "Semanal" && data.weekDay == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weekDay"],
      message: "Dia da semana é obrigatório para tarefas semanais",
    });
  }
  if (data.recurrence === "Mensal" && data.monthDay == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["monthDay"],
      message: "Dia do mês é obrigatório para tarefas mensais",
    });
  }
});

export const updateTaskSchema = baseTaskSchema.partial().superRefine((data, ctx) => {
  if (data.recurrence === "Semanal" && data.weekDay === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weekDay"],
      message: "Dia da semana é obrigatório para tarefas semanais",
    });
  }
  if (data.recurrence === "Mensal" && data.monthDay === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["monthDay"],
      message: "Dia do mês é obrigatório para tarefas mensais",
    });
  }
});

export const upcomingOccurrencesQuerySchema = z.object({
  horizonDays: z.coerce.number().int().positive().max(365).optional(),
  occurrencesPerTask: z.coerce.number().int().positive().max(50).optional(),
});

export const remindersQuerySchema = z.object({
  windowHours: z.coerce.number().int().positive().max(24 * 30).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
