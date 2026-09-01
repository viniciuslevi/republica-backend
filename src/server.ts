import { buildApp } from "./app.js";
import { env } from "./shared/config/env.js";
import { connectDatabase } from "./shared/database/connection.js";
import { scheduleRecurringTasksReset } from "./shared/jobs/resetRecurringTasks.js";

async function start() {
  const app = await buildApp();

  try {
    await connectDatabase();
    app.log.info("Conectado ao MongoDB");

    scheduleRecurringTasksReset(app.log);

    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
