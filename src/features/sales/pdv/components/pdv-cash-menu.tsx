import { useState } from "react";
import { ChevronDown, Eye, MinusCircle, PlusCircle, DoorOpen } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloseSessionDialog, MovementDialog } from "@/features/cash";
import type { CashSession } from "@/features/cash";
import {
  PDV_CASH_MENU_ITEMS,
  pdvCashMenuLabel,
  type PdvCashMenuAction,
} from "../lib/cash-menu";

export const PDV_CASH_MENU_TRIGGER_ID = "pdv-cash-menu";

const ICONS: Record<PdvCashMenuAction, typeof Eye> = {
  "view-session": Eye,
  "cash-out": MinusCircle,
  "cash-in": PlusCircle,
  "close-cash": DoorOpen,
};

type Props = {
  companyId: string;
  companyName: string;
  operatorId: string;
  session: CashSession | null | undefined;
  /** Diálogo de fechamento controlado (permite o atalho F12). */
  closeOpen: boolean;
  onCloseOpenChange: (open: boolean) => void;
};

/**
 * PDV — Botão/menu operacional do caixa (somente UX/UI).
 *
 * Nenhum diálogo novo: reutiliza `MovementDialog` (sangria/suprimento) e
 * `CloseSessionDialog` do módulo Caixa, e navega para /caixa em "Ver sessão".
 */
export function PDVCashMenu({
  companyId,
  companyName,
  operatorId,
  session,
  closeOpen,
  onCloseOpenChange,
}: Props) {
  const navigate = useNavigate();
  const [movement, setMovement] = useState<"cash_in" | "cash_out" | null>(null);
  const label = pdvCashMenuLabel(session);

  function run(action: PdvCashMenuAction) {
    if (!session) return;
    if (action === "view-session") void navigate({ to: "/caixa" });
    if (action === "cash-out") setMovement("cash_out");
    if (action === "cash-in") setMovement("cash_in");
    if (action === "close-cash") onCloseOpenChange(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            id={PDV_CASH_MENU_TRIGGER_ID}
            type="button"
            disabled={!session}
            aria-label="Menu do caixa"
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
              label.open
                ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15"
                : "border-destructive/40 bg-destructive/10",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                label.open ? "bg-emerald-500" : "bg-destructive",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                {label.title}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {label.detail && (
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {label.detail}
                </span>
              )}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {PDV_CASH_MENU_ITEMS.map((item) => {
            const Icon = ICONS[item.action];
            return (
              <div key={item.action}>
                {item.separatorBefore && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onSelect={() => run(item.action)}
                  className={cn(item.danger && "text-destructive focus:text-destructive")}
                >
                  <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {item.label}
                  {item.hint && (
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </DropdownMenuItem>
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {session && (
        <>
          <MovementDialog
            open={movement !== null}
            onOpenChange={(o) => !o && setMovement(null)}
            type={movement ?? "cash_in"}
            sessionId={session.id}
            companyId={companyId}
            createdBy={operatorId}
          />
          <CloseSessionDialog
            open={closeOpen}
            onOpenChange={onCloseOpenChange}
            session={session}
            companyName={companyName}
            onClosed={() => onCloseOpenChange(false)}
          />
        </>
      )}
    </>
  );
}
