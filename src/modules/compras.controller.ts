// Interfaces para definir os tipos de dados
interface IItemCompra {
  nome: string;
  quantidade: number;
  solicitante: string;
  residenceId?: string | null;
}

import { CompraModel } from "./compras.model.js";

// SCRUM-21: Adicionar item à lista de compras
export const adicionarItem = async (req: any, res: any) => {
  try {
    const { nome, quantidade, solicitante, residenceId } = req.body;

    if (!nome || !quantidade) {
      return res
        .status(400)
        .send({ erro: "Nome e quantidade são obrigatórios." });
    }

    const novoItem = await CompraModel.create({
      nome,
      quantidade,
      solicitante: solicitante || "Morador",
      isComprado: false,
      residenceId: residenceId || null,
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

    const itemAtualizado = await CompraModel.findByIdAndUpdate(
      id,
      { isComprado: true },
      { new: true },
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

// Recuperar todos os itens da lista de compras
// Suporta filtros opcionais: ?isComprado=true/false e ?residenceId=<id>
export const listarItens = async (req: any, res: any) => {
  try {
    const { isComprado, residenceId } = req.query || {};
    const filtro: Record<string, any> = {};

    if (isComprado !== undefined) {
      filtro.isComprado = isComprado === "true";
    }

    if (residenceId) {
      filtro.residenceId = residenceId;
    }

    const itens = await CompraModel.find(filtro).sort({ createdAt: -1 });

    return res.status(200).send({
      mensagem: "Itens recuperados com sucesso!",
      total: itens.length,
      dados: itens,
    });
  } catch (erro) {
    console.error("Erro ao recuperar itens da lista de compras:", erro);
    return res
      .status(500)
      .send({ erro: "Erro interno ao buscar os itens da lista de compras." });
  }
};

// Recuperar um item específico da lista de compras pelo ID
export const obterItemPorId = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const item = await CompraModel.findById(id);

    if (!item) {
      return res.status(404).send({ erro: "Item não encontrado." });
    }

    return res.status(200).send({
      mensagem: "Item recuperado com sucesso!",
      dados: item,
    });
  } catch (erro) {
    console.error("Erro ao buscar item por ID:", erro);
    return res.status(500).send({ erro: "Erro interno ao buscar o item." });
  }
};

// Remover um item da lista de compras pelo ID
export const removerItem = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const itemRemovido = await CompraModel.findByIdAndDelete(id);

    if (!itemRemovido) {
      return res.status(404).send({ erro: "Item não encontrado." });
    }

    return res.status(200).send({ mensagem: "Item removido com sucesso." });
  } catch (erro) {
    console.error("Erro ao remover item:", erro);
    return res.status(500).send({ erro: "Erro interno ao remover o item." });
  }
};
