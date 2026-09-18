import {
  consultarHistorico,
  filtrarHistorico,
} from "./historico.controller.js";

export async function historicoRoutes(app: any) {
  // SCRUM-23: Consultar histórico de tarefas e despesas
  app.get("/historico", consultarHistorico);

  // SCRUM-24: Filtrar histórico por período/morador/tipo
  app.get("/historico/filtrar", filtrarHistorico);
}
