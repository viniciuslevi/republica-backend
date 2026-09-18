import { z } from "zod";

export const historyQuerySchema = z.object({
  type: z.enum(["all", "task", "expense"]).optional().default("all"),
  residentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().positive().optional(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
