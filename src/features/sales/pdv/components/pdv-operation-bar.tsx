import { memo } from "react";
import { MonitorSmartphone, User, Wallet, Hash, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDVSearch } from "./pdv-search";
import { PDVShortcutsPanel } from "./pdv-shortcuts-panel";
import {
  PDV_STATUS_TONE_CLASS,
  PDV_STAGE_LABEL,
  type PdvCashStatus,
  type PdvStage,
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
};

function MetaItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-xs font-medium",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * PDV — Barra de operação (Sprint 2.9).
 *
 * Somente apresentação: reúne a busca (que também recebe o leitor USB) e
 * exibe caixa, operador, sessão e número da venda. Nenhuma ação nova.
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
  sessionLabel,
}: Props) {
  return (
    <header className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight">
              Venda
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Origem: PDV · Atendimento de balcão
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              PDV_STATUS_TONE_CLASS[
                stage === "completed"
                  ? "done"
                  : stage === "receiving"
                    ? "pending"
                    : "open"
              ],
            )}
          >
            {PDV_STAGE_LABEL[stage]}
          </span>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              PDV_STATUS_TONE_CLASS[cashStatus.tone],
            )}
          >
            {cashStatus.label}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-2 border-t pt-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetaItem icon={Wallet} label="Caixa" value={cashStatus.label} />
        <MetaItem icon={User} label="Operador" value={operatorName || "—"} />
        <MetaItem
          icon={Clock}
          label="Sessão"
          value={sessionLabel || "—"}
          mono
        />
        <MetaItem icon={Hash} label="Venda" value={saleNumber} mono />
      </div>

      <div className="mt-4">
        <PDVSearch
          companyId={companyId}
          value={search}
          onChange={onSearchChange}
          onSelect={onProduct}
          onClear={onClearSearch}
          disabled={stage !== "cart"}
        />
        <div className="mt-2.5">
          <PDVShortcutsPanel />
        </div>
      </div>
    </header>
  );
});
