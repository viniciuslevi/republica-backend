// Definindo os tipos para os filtros da requisição
interface IFiltroHistorico {
    dataInicio?: string;
    dataFim?: string;
    moradorId?: string;
}

// SCRUM-23: Consultar histórico geral
export const consultarHistorico = async (req: any, res: any) => {
    try {
        // TODO: Realizar um .find() nas collections do MongoDB
        // Simulando um retorno do banco de dados para a apresentação
        const historicoMock = [
            { tipo: "COMPRA", descricao: "Detergente e Esponja", data: new Date() },
            { tipo: "TAREFA", descricao: "Limpeza do Banheiro", data: new Date() }
        ];

        if (historicoMock.length === 0) {
            return res.status(404).send({ mensagem: "Nenhum histórico encontrado." });
        }

        return res.status(200).send({ 
            mensagem: "Histórico recuperado com sucesso.",
            total: historicoMock.length,
            dados: historicoMock 
        });

    } catch (erro) {
        console.error("Erro ao consultar histórico:", erro);
        return res.status(500).send({ erro: "Falha ao consultar o banco de dados." });
    }
};

// SCRUM-24: Filtrar histórico
export const filtrarHistorico = async (req: any, res: any) => {
    try {
        // Pegando os parâmetros de filtro da URL
        const filtros = req.query as IFiltroHistorico;

        // TODO: Montar a query dinâmica do MongoDB usando os filtros acima
        let queryMongo = {};
        
        if (filtros.moradorId) {
            // Exemplo de como a query seria montada: queryMongo.responsavel = filtros.moradorId;
            console.log(`Filtrando pelo morador: ${filtros.moradorId}`);
        }

        return res.status(200).send({ 
            mensagem: "Filtros aplicados com sucesso (Simulação).",
            filtrosRecebidos: filtros 
        });

    } catch (erro) {
        console.error("Erro ao aplicar filtros:", erro);
        return res.status(500).send({ erro: "Erro ao processar os filtros de busca." });
    }
};