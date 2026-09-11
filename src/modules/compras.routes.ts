import { adicionarItem, marcarComoComprado } from "./compras.controller.js";

export async function comprasRoutes(app: any) {
  // Rota para criar o item (POST)
  app.post("/compras", adicionarItem);

  // Rota para atualizar o item como comprado (PATCH ou PUT)
  app.patch("/compras/:id/comprado", marcarComoComprado);
}
