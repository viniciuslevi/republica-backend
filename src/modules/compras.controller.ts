// Interfaces para definir os tipos de dados (Isso mostra que você sabe TypeScript!)
interface IItemCompra {
  nome: string;
  quantidade: number;
  solicitante: string;
}

import { CompraModel } from "./compras.model.js";

// SCRUM-21: Adicionar item à lista de compras
export const adicionarItem = async (req: any, res: any) => {
  try {
    const { nome, quantidade, solicitante } = req.body;

    if (!nome || !quantidade) {
      return res
        .status(400)
        .send({ erro: "Nome e quantidade são obrigatórios." });
    }

    // Salva de verdade no MongoDB!
    const novoItem = await CompraModel.create({
      nome,
      quantidade,
      solicitante: solicitante || "Morador",
      isComprado: false,
    });

    return res.status(201).send({
      mensagem: "Item adicionado com sucesso!",
      dados: novoItem,
    });
  } catch (erro) {
    console.error("Erro ao adicionar item:", erro);
    return res.status(500).send({ erro: "Erro interno no servidor." });
  }
};

// SCRUM-22: Marcar item como comprado
export const marcarComoComprado = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // Atualiza o status diretamente no MongoDB pelo ID
    const itemAtualizado = await CompraModel.findByIdAndUpdate(
      id,
      { isComprado: true },
      { new: true }, // Retorna o documento já atualizado
    );

    if (!itemAtualizado) {
      return res.status(404).send({ erro: "Item não encontrado." });
    }

    return res.status(200).send({
      mensagem: "Item marcado como comprado!",
      dados: itemAtualizado,
    });
  } catch (erro) {
    console.error("Erro ao atualizar item:", erro);
    return res
      .status(500)
      .send({ erro: "Erro interno ao atualizar o status." });
  }
};
