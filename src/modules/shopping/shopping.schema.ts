import { z } from "zod";

export const createShoppingItemSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do item"),
  quantity: z.string().trim().optional(),
});

export const updateShoppingItemSchema = z.object({
  name: z.string().trim().min(1).optional(),
  quantity: z.string().trim().optional(),
  purchased: z.boolean().optional(),
});

export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemSchema>;
