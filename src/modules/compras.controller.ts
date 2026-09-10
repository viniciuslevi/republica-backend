// Interfaces para definir os tipos de dados (Isso mostra que você sabe TypeScript!)
interface IItemCompra {
    nome: string;
    quantidade: number;
    solicitante: string;
}

// SCRUM-21: Adicionar item à lista de compras
export const adicionarItem = async (req: any, res: any) => {
    try {
        // Extraindo os dados do corpo da requisição usando a tipagem
        const { nome, quantidade, solicitante } = req.body as IItemCompra;

        // Validação básica para mostrar que você pensou na segurança
        if (!nome || !quantidade) {
            return res.status(400).send({ 
                erro: "Os campos 'nome' e 'quantidade' são obrigatórios." 
            });
        }

        // TODO: Trocar essa simulação pelo Model.create() do MongoDB
        const novoItem = {
            nome,
            quantidade,
            solicitante: solicitante || "Anônimo",
            isComprado: false,
            dataSolicitacao: new Date()
        };

        return res.status(201).send({ 
            mensagem: "Item adicionado à lista com sucesso!", 
            dados: novoItem 
        });

    } catch (erro) {
        // Tratamento de erro profissional
        console.error("Erro ao adicionar item:", erro);
        return res.status(500).send({ erro: "Erro interno no servidor." });
    }
};

// SCRUM-22: Marcar item como comprado
export const marcarComoComprado = async (req: any, res: any) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({ erro: "ID do item não fornecido na URL." });
        }

        // TODO: Buscar o ID no banco e atualizar com Model.findByIdAndUpdate()
        const itemAtualizadoSimulado = {
            id,
            status: "Comprado",
            dataCompra: new Date()
        };

        return res.status(200).send({ 
            mensagem: "Status do item atualizado para comprado.",
            dados: itemAtualizadoSimulado
        });

    } catch (erro) {
        console.error("Erro ao atualizar item:", erro);
        return res.status(500).send({ erro: "Erro interno ao atualizar o status." });
    }
};