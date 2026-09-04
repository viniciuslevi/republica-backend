import { z } from "zod";

export const createExpenseSchema = z.object({
  description: z.string({ required_error: "Informe a descrição da despesa" }).trim().min(1, "Informe a descrição da despesa"),
  value: z.coerce
    .number({
      invalid_type_error: "Informe um valor numérico válido para a despesa",
      required_error: "Informe o valor da despesa",
    })
    .positive("O valor da despesa deve ser um número positivo maior que zero"),
  payerId: z.string({ required_error: "Informe quem pagou a despesa" }).trim().min(1, "Informe quem pagou a despesa"),
  participantIds: z.array(z.string().trim().min(1)).optional(),
  date: z.coerce.date().optional(),
});

export const createExpenseTopLevelSchema = createExpenseSchema.extend({
  residenceId: z.string().trim().min(1, "Informe a residência da despesa").optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseTopLevelInput = z.infer<typeof createExpenseTopLevelSchema>;
