import mongoose from "mongoose";
import { TaskModel } from "./tasks/task.model.js";
import { ExpenseModel } from "./expenses/expense.model.js";
import { CompraModel } from "./compras.model.js";
import "./auth/user.model.js"; // Garante registro do modelo User para populate

// Definindo os tipos para os filtros da requisição
export interface IFiltroHistorico {
  dataInicio?: string;
  dataFim?: string;
  moradorId?: string;
  tipo?: string;
  residenceId?: string;
}

// Função auxiliar para construir o filtro de intervalo de datas
function construirFiltroData(dataInicio?: string, dataFim?: string) {
  const filtro: Record<string, any> = {};

  if (dataInicio) {
    const inicio = new Date(dataInicio);
    if (!isNaN(inicio.getTime())) {
      filtro.$gte = inicio;
    }
  }

  if (dataFim) {
    const fim = new Date(dataFim);
    if (!isNaN(fim.getTime())) {
      // Se enviado apenas YYYY-MM-DD, ajusta para o final do dia
      if (dataFim.length <= 10) {
        fim.setUTCHours(23, 59, 59, 999);
      }
      filtro.$lte = fim;
    }
  }

  return Object.keys(filtro).length > 0 ? filtro : null;
}

// Função central de busca no banco de dados
async function buscarHistoricoNoBanco(filtros: IFiltroHistorico) {
  const { dataInicio, dataFim, moradorId, tipo, residenceId } = filtros;
  const filtroData = construirFiltroData(dataInicio, dataFim);
  const isValidObjectId = moradorId && mongoose.isValidObjectId(moradorId);
  const isValidResidenceId =
    residenceId && mongoose.isValidObjectId(residenceId);

  const tipoFormatado = tipo ? String(tipo).trim().toUpperCase() : null;
  const buscarTodas = !tipoFormatado || tipoFormatado === "TODOS";
  const buscarTarefas =
    buscarTodas || tipoFormatado === "TAREFA" || tipoFormatado === "TAREFAS";
  const buscarDespesas =
    buscarTodas || tipoFormatado === "DESPESA" || tipoFormatado === "DESPESAS";
  const buscarCompras =
    buscarTodas || tipoFormatado === "COMPRA" || tipoFormatado === "COMPRAS";

  const promessas: Promise<any[]>[] = [];

  // 1. TAREFAS
  if (buscarTarefas) {
    const queryTarefa: Record<string, any> = {};
    if (filtroData) queryTarefa.createdAt = filtroData;
    if (moradorId && isValidObjectId) queryTarefa.assigneeId = moradorId;
    if (isValidResidenceId) queryTarefa.residenceId = residenceId;

    promessas.push(
      TaskModel.find(queryTarefa)
        .populate("assigneeId", "name email")
        .sort({ createdAt: -1 })
        .lean()
        .then((tarefas) =>
          tarefas.map((t: any) => ({
            id: t._id,
            tipo: "TAREFA",
            descricao: t.title + (t.description ? ` - ${t.description}` : ""),
            data: t.lastCompletedAt || t.dueDate || t.createdAt,
            morador: t.assigneeId
              ? {
                  id: t.assigneeId._id,
                  nome: t.assigneeId.name,
                  email: t.assigneeId.email,
                }
              : null,
            detalhes: {
              concluida: t.done,
              prioridade: t.priority,
              recorrencia: t.recurrence,
            },
          })),
        ),
    );
  }

  // 2. DESPESAS
  if (buscarDespesas) {
    const queryDespesa: Record<string, any> = {};
    if (filtroData) queryDespesa.date = filtroData;
    if (moradorId && isValidObjectId) queryDespesa.payerId = moradorId;
    if (isValidResidenceId) queryDespesa.residenceId = residenceId;

    promessas.push(
      ExpenseModel.find(queryDespesa)
        .populate("payerId", "name email")
        .sort({ date: -1 })
        .lean()
        .then((despesas) =>
          despesas.map((d: any) => ({
            id: d._id,
            tipo: "DESPESA",
            descricao: d.description,
            data: d.date || d.createdAt,
            morador: d.payerId
              ? {
                  id: d.payerId._id,
                  nome: d.payerId.name,
                  email: d.payerId.email,
                }
              : null,
            detalhes: {
              valor: d.value,
            },
          })),
        ),
    );
  }

  // 3. COMPRAS
  if (buscarCompras) {
    const queryCompra: Record<string, any> = {};
    if (filtroData) queryCompra.createdAt = filtroData;
    if (moradorId) {
      queryCompra.solicitante = new RegExp(String(moradorId), "i");
    }

    promessas.push(
      CompraModel.find(queryCompra)
        .sort({ createdAt: -1 })
        .lean()
        .then((compras) =>
          compras.map((c: any) => ({
            id: c._id,
            tipo: "COMPRA",
            descricao: `${c.nome} (Qtd: ${c.quantidade})`,
            data: c.dataSolicitacao || c.createdAt,
            morador: { nome: c.solicitante },
            detalhes: {
              quantidade: c.quantidade,
              isComprado: c.isComprado,
            },
          })),
        ),
    );
  }

  const resultados = await Promise.all(promessas);
  return resultados
    .flat()
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

// SCRUM-23: Consultar histórico geral de tarefas e despesas
export const consultarHistorico = async (req: any, res: any) => {
  try {
    const filtros = (req.query || {}) as IFiltroHistorico;
    const historico = await buscarHistoricoNoBanco(filtros);

    return res.status(200).send({
      mensagem:
        historico.length > 0
          ? "Histórico recuperado com sucesso."
          : "Nenhum histórico encontrado.",
      total: historico.length,
      dados: historico,
    });
  } catch (erro) {
    console.error("Erro ao consultar histórico:", erro);
    return res
      .status(500)
      .send({ erro: "Falha ao consultar o histórico no banco de dados." });
  }
};

// SCRUM-24: Filtrar histórico por período/morador/tipo
export const filtrarHistorico = async (req: any, res: any) => {
  try {
    const filtros = (req.query || {}) as IFiltroHistorico;
    const historico = await buscarHistoricoNoBanco(filtros);

    return res.status(200).send({
      mensagem: "Filtros aplicados com sucesso.",
      total: historico.length,
      filtrosAplicados: filtros,
      dados: historico,
    });
  } catch (erro) {
    console.error("Erro ao aplicar filtros no histórico:", erro);
    return res
      .status(500)
      .send({ erro: "Erro ao processar os filtros de busca do histórico." });
  }
};
