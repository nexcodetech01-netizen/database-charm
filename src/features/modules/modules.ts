/**
 * Módulos que cada empresa pode ligar/desligar (Configurações › Módulos).
 * Desligar só esconde do menu — nenhum dado é apagado. Sem configuração,
 * tudo fica ligado.
 */
export type ModuleKey =
  | "consignacao"
  | "fiscal"
  | "bella"
  | "whatsapp"
  | "marketing"
  | "fidelidade"
  | "lista_compras"
  | "avancado";

export interface ModuleDefinition {
  key: ModuleKey;
  title: string;
  description: string;
  /** Itens do menu que somem quando o módulo está desligado. */
  menuItems: string[];
}

export const MODULES: ModuleDefinition[] = [
  {
    key: "consignacao",
    title: "Consignação",
    description: "Peças com revendedores, contratos e acertos.",
    menuItems: ["Consignações", "Revendedores"],
  },
  {
    key: "fiscal",
    title: "Fiscal",
    description: "Emissão de nota fiscal e acompanhamento do limite do MEI/Simples.",
    menuItems: ["Fiscal", "Saúde Fiscal"],
  },
  {
    key: "bella",
    title: "Bella IA",
    description: "Assistente com inteligência artificial e contadora virtual.",
    menuItems: ["Bella IA", "Bella Contadora", "Conhecimento Bella"],
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    description: "Atendimento pelo WhatsApp oficial e lista de interesse de clientes.",
    menuItems: ["WhatsApp", "Inbox WhatsApp", "Lista de Interesse"],
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "Campanhas e público para divulgação.",
    menuItems: ["Marketing"],
  },
  {
    key: "fidelidade",
    title: "Fidelidade",
    description: "Programa de pontos para clientes.",
    menuItems: ["Fidelidade"],
  },
  {
    key: "lista_compras",
    title: "Lista de compras",
    description: "Lista do que repor ou comprar para a loja.",
    menuItems: ["Lista de compras"],
  },
  {
    key: "avancado",
    title: "Ferramentas avançadas",
    description: "Recálculo de preços em massa, histórico de alterações e saúde da plataforma.",
    menuItems: ["Recalcular Preços", "Histórico de alterações", "Saúde da Plataforma"],
  },
];

export type EnabledModules = Partial<Record<ModuleKey, boolean>>;

/** Módulo sem configuração = ligado. */
export function isModuleEnabled(config: EnabledModules | null | undefined, key: ModuleKey) {
  return config?.[key] !== false;
}
