import { memo, type ReactNode } from "react";
import { MonitorSmartphone, User, Wallet, Hash, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDVSearch } from "./pdv-search";
import { PDVShortcutsDialog } from "./pdv-shortcuts-panel";
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
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "block truncate text-sm font-semibold leading-tight",
            mono && "font-mono tabular-nums",
          )}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

/**
 * PDV — Barra de operação (Sprint 3.1).
 *
 * Somente apresentação: identidade da tela, indicadores essenciais e a área
 * de pesquisa — que é o elemento dominante do cabeçalho. Nenhuma ação nova.
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
  activity,
  cashMenu,
}: Props) {
  return (
    <header className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
            <MonitorSmartphone
              className="h-5 w-5 text-primary"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-tight">PDV</p>
            <p className="truncate text-sm text-muted-foreground">
              Venda de balcão
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {activity ? (
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                PDV_STATUS_TONE_CLASS[activity.tone],
              )}
            >
              {activity.label}
            </span>
          ) : (
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
          )}
          {cashMenu ?? (
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                PDV_STATUS_TONE_CLASS[cashStatus.tone],
              )}
            >
              {cashStatus.label}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5">
        <PDVSearch
          companyId={companyId}
          value={search}
          onChange={onSearchChange}
          onSelect={onProduct}
          onClear={onClearSearch}
          disabled={stage !== "cart"}
        />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t pt-4">
        <div className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <PDVShortcutsDialog />
      </div>
    </header>
  );
});
