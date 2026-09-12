import { z } from "zod";

export const createShoppingItemSchema = z.object({
  name: z.string({ required_error: "Informe o nome do item" }).trim().min(1, "Informe o nome do item"),
  quantity: z.string().trim().min(1).optional(),
});

export const updatePurchasedSchema = z.object({
  purchased: z.boolean().optional().default(true),
});

export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
export type UpdatePurchasedInput = z.infer<typeof updatePurchasedSchema>;
