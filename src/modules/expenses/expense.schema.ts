import { z } from "zod";

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição da despesa"),
  value: z.coerce.number().positive("O valor deve ser maior que zero"),
  payerId: z.string().trim().min(1, "Informe quem pagou"),
  participantIds: z.array(z.string().trim()).min(1, "Informe ao menos um participante"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
