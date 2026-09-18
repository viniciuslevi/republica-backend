import type { FastifyReply, FastifyRequest } from "fastify";
import { reportService } from "./report.service.js";
import { summaryReportQuerySchema } from "./report.schema.js";

export const reportController = {
  async getSummary(request: FastifyRequest, reply: FastifyReply) {
    const { residenceId } = request.params as { residenceId: string };
    const query = summaryReportQuerySchema.parse(request.query);

    const report = await reportService.getSummaryReport(residenceId, query);
    return reply.status(200).send(report);
  },
};
