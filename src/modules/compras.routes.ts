import {
  adicionarItem,
  marcarComoComprado,
  listarItens,
  obterItemPorId,
  removerItem,
} from "./compras.controller.js";

export async function comprasRoutes(app: any) {
  // Listar todos os itens (suporta ?residenceId=<id> e ?isComprado=true/false)
  app.get("/compras", listarItens);

  // Recuperar um item específico pelo ID
  app.get("/compras/:id", obterItemPorId);

  // Criar novo item
  app.post("/compras", adicionarItem);

  // Marcar item como comprado
  app.patch("/compras/:id/comprado", marcarComoComprado);

  // Remover item
  app.delete("/compras/:id", removerItem);
}
