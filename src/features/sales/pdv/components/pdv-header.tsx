import { MonitorSmartphone, Wallet } from "lucide-react";
import { formatOpenedAt } from "@/features/cash";
import { PDVSettingsDialog } from "./pdv-settings-dialog";

type Props = {
  /** Momento de abertura da sessão de caixa vigente, quando houver. */
  openedAt?: string | null;
  companyId?: string;
};

/** Cabeçalho do PDV — exibe a sessão de caixa vigente (Sprint 2.3). */
export function PDVHeader({ openedAt, companyId }: Props = {}) {
  return (
    <header className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold leading-none">PDV</p>
          <p className="text-xs text-muted-foreground">Atendimento de balcão</p>
        </div>
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        {openedAt ? `Caixa aberto em ${formatOpenedAt(openedAt)}` : "Caixa fechado"}
      </span>
    </header>
  );
}
