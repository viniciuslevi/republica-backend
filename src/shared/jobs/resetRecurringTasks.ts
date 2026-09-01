import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { taskService } from "../../modules/tasks/task.service.js";

/**
 * Fallback diário para o reset "preguiçoso" feito em task.service (que só roda quando
 * alguém lista as tarefas de uma residência). Garante que tarefas recorrentes concluídas
 * voltem a aparecer pendentes mesmo em residências que ninguém abriu no dia.
 */
export function scheduleRecurringTasksReset(logger: FastifyBaseLogger) {
  return cron.schedule("5 0 * * *", async () => {
    try {
      const resetCount = await taskService.resetAllOverdueTasks();
      logger.info({ resetCount }, "Reset diário de tarefas recorrentes concluído");
    } catch (error) {
      logger.error({ error }, "Falha ao executar reset diário de tarefas recorrentes");
    }
  });
}
