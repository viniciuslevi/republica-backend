import { z } from "zod";

export const createResidenceSchema = z.object({
  name: z.string().trim().min(2, "O nome da residência deve ter pelo menos 2 caracteres"),
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export const joinResidenceSchema = z.object({
  code: z.string().trim().min(1, "Informe o código de convite"),
});

export type CreateResidenceInput = z.infer<typeof createResidenceSchema>;
export type JoinResidenceInput = z.infer<typeof joinResidenceSchema>;
