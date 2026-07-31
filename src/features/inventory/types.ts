import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type InventoryMovement = Tables<"inventory_movements">;
export type InventoryMovementInsert = TablesInsert<"inventory_movements">;

export type MovementType =
  | "in"
  | "out"
  | "adjustment"
  | "transfer"
  | "reservation"
  | "opening";
/** Abertura (saldo inicial) é criada apenas pelo assistente de reconciliação. */
export type ManualMovementType = Exclude<MovementType, "opening">;

export type MovementSource =
  | "manual"
  | "purchase"
  | "sale"
  | "adjustment"
  | "return"
  | "system"
  | "opening";

export const MOVEMENT_TYPE_OPTIONS: {
  value: MovementType;
  label: string;
  description: string;
  disabled?: boolean;
}[] = [
  { value: "in", label: "Entrada", description: "Adiciona itens ao estoque" },
  { value: "out", label: "Saída", description: "Remove itens do estoque" },
  {
    value: "adjustment",
    label: "Ajuste",
    description: "Corrige o saldo (use valores negativos para reduzir)",
  },
  {
    value: "reservation",
    label: "Reserva",
    description: "Registra reserva sem alterar o saldo físico",
  },
  {
    value: "transfer",
    label: "Transferência",
    description: "Entre locais — em breve",
    disabled: true,
  },
];

export const MOVEMENT_SOURCE_OPTIONS: { value: MovementSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "purchase", label: "Compra" },
  { value: "sale", label: "Venda" },
  { value: "adjustment", label: "Ajuste" },
  { value: "return", label: "Devolução" },
  { value: "system", label: "Sistema" },
  { value: "opening", label: "Saldo inicial" },
];

export const MOVEMENT_SOURCE_LABEL: Record<MovementSource, string> =
  MOVEMENT_SOURCE_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<MovementSource, string>,
  );

export const MOVEMENT_REASONS: Record<MovementType, string[]> = {
  in: ["Compra", "Devolução de cliente", "Produção", "Transferência recebida", "Outro"],
  out: ["Venda", "Devolução ao fornecedor", "Perda", "Uso interno", "Outro"],
  adjustment: ["Inventário", "Correção de erro", "Quebra", "Outro"],
  reservation: ["Pedido em andamento", "Orçamento", "Reserva manual", "Outro"],
  transfer: ["Transferência entre locais"],
  opening: ["Saldo inicial"],
};

export type MovementSortKey = "movement_date" | "type" | "quantity";
export type SortDir = "asc" | "desc";

export interface MovementListFilters {
  search: string;
  productId: string;
  type: string;
  source: string;
  from: string;
  to: string;
  sortBy: MovementSortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

export const DEFAULT_MOVEMENT_FILTERS: MovementListFilters = {
  search: "",
  productId: "",
  type: "",
  source: "",
  from: "",
  to: "",
  sortBy: "movement_date",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
};
