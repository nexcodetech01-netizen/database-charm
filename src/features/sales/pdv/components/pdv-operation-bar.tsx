import { MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDVSearch } from "./pdv-search";
import { PDVBarcodeInput } from "./pdv-barcode-input";
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
};

/**
 * PDV — Barra de operação (Sprint 2.9).
 *
 * Somente apresentação: reúne a busca e o leitor já existentes e exibe o
 * status do caixa e o número da venda. Nenhuma ação nova.
 */
export function PDVOperationBar({
  companyId,
  saleNumber,
  stage,
  cashStatus,
  search,
  onSearchChange,
  onProduct,
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
              PDV · Atendimento de balcão
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              Venda {saleNumber}
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

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <PDVBarcodeInput companyId={companyId} onProduct={onProduct} />
        <PDVSearch
          companyId={companyId}
          value={search}
          onChange={onSearchChange}
          onSelect={onProduct}
        />
      </div>
    </header>
  );
}
