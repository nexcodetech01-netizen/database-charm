import { memo, type ReactNode } from "react";
import { User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDVSearch } from "./pdv-search";
import {
  PDV_STATUS_TONE_CLASS,
  PDV_STAGE_LABEL,
  type PdvCashStatus,
  type PdvStage,
  type PdvActivity,
} from "../lib/layout";
import type { PDVProductOption } from "../types";

type Props = {
  companyId: string;
  saleNumber: string;
  stage: PdvStage;
  cashStatus: PdvCashStatus;
  search: string;
  onSearchChange: (value: string) => void;
  onProduct: (product: PDVProductOption) => void;
  onClearSearch?: () => void;
  /** Operador logado no balcão (apenas exibição). */
  operatorName?: string;
  /** Identificador curto da sessão de caixa vigente (apenas exibição). */
  sessionLabel?: string | null;
  /** Estado visual da operação (processando, emitindo NFC-e, concluída). */
  activity?: PdvActivity | null;
  /** Botão/menu operacional do caixa (somente UX). */
  cashMenu?: ReactNode;
};

function MetaChip({
  icon: Icon,
  value,
  title,
}: {
  icon: typeof User;
  value: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate font-medium text-foreground/80">{value}</span>
    </span>
  );
}

/**
 * PDV — Barra de operação compacta (Sprint PDV.3.1).
 *
 * Somente apresentação. Sem título decorativo, sem subtítulo e sem
 * informação duplicada: busca/leitor dominam a barra e a linha inferior
 * traz apenas caixa e operador. Nenhuma ação nova.
 */
export const PDVOperationBar = memo(function PDVOperationBar({
  companyId,
  saleNumber,
  stage,
  cashStatus,
  search,
  onSearchChange,
  onProduct,
  onClearSearch,
  operatorName,
  activity,
  cashMenu,
}: Props) {
  return (
    <header className="rounded-xl border bg-card px-3 py-2 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <PDVSearch
          companyId={companyId}
          value={search}
          onChange={onSearchChange}
          onSelect={onProduct}
          onClear={onClearSearch}
          disabled={stage !== "cart"}
        />
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "hidden rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-block",
              PDV_STATUS_TONE_CLASS[
                activity
                  ? activity.tone
                  : stage === "completed"
                    ? "done"
                    : stage === "receiving"
                      ? "pending"
                      : "open"
              ],
            )}
          >
            {activity ? activity.label : PDV_STAGE_LABEL[stage]}
          </span>
          {cashMenu}
        </div>
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-4 overflow-hidden">
        <MetaChip icon={Wallet} value={cashStatus.label} title="Caixa" />
        <MetaChip
          icon={User}
          value={operatorName || "—"}
          title="Operador"
        />
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {saleNumber}
        </span>
      </div>
    </header>
  );
});
