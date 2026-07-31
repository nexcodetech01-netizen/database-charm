export interface ConversationEntry {
  id: string;
  question: string;
  when: string;
  summary?: string;
}

export const CONVERSATION_HISTORY: ConversationEntry[] = [
  {
    id: "c1",
    question: "Quais clientes ainda não pagaram este mês?",
    when: "há 2h",
    summary: "8 clientes com faturas vencidas totalizando R$ 4.320.",
  },
  {
    id: "c2",
    question: "Qual categoria vendeu mais na última semana?",
    when: "ontem",
    summary: "Acessórios lidera com R$ 12.450 em vendas.",
  },
  {
    id: "c3",
    question: "Quanto gastei com fornecedores em outubro?",
    when: "há 2 dias",
    summary: "Total de R$ 38.900 pagos a 6 fornecedores.",
  },
  {
    id: "c4",
    question: "Quais produtos estão parados no estoque?",
    when: "há 3 dias",
    summary: "30 SKUs sem venda nos últimos 60 dias.",
  },
];
