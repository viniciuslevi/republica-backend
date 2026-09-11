import { z } from "zod";

export const summaryReportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type SummaryReportQuery = z.infer<typeof summaryReportQuerySchema>;
