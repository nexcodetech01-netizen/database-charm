import { useState } from "react";
import {
  DoorOpen,
  MinusCircle,
  PlusCircle,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency } from "@/lib/format";
import { useOpenCashSession } from "../hooks/use-cash";
import { OpenSessionDialog } from "./open-session-dialog";
import { MovementDialog } from "./movement-dialog";
import { CloseSessionDialog } from "./close-session-dialog";

interface Props {
  companyId: string;
  companyName?: string;
}

export function CashSessionCard({ companyId, companyName }: Props) {
  const { user } = useAuth();
  const operatorId = user?.id ?? "";
  const operatorName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Operador";

  const { data: openSession, isLoading } = useOpenCashSession(
    companyId,
    operatorId,
  );

  const [openDialog, setOpenDialog] = useState(false);
  const [movement, setMovement] = useState<"cash_in" | "cash_out" | null>(null);
  const [closing, setClosing] = useState(false);

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!openSession) {
    return (
      <>
        <Card className="border-primary/40 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Caixa Fechado</h3>
                  <Badge variant="secondary">Nenhuma sessão aberta</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abra o caixa para registrar vendas, suprimentos e sangrias do dia.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setOpenDialog(true)}
              className="gap-2"
              disabled={!operatorId}
            >
              <DoorOpen className="h-4 w-4" /> Abrir Caixa
            </Button>
          </div>
        </Card>

        {operatorId && (
          <OpenSessionDialog
            open={openDialog}
            onOpenChange={setOpenDialog}
            companyId={companyId}
            operatorId={operatorId}
            operatorName={operatorName}
          />
        )}
      </>
    );
  }

  const openedAt = new Date(openSession.opened_at).toLocaleString("pt-BR");
  const opening = Number(openSession.opening_balance ?? 0);

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-success/10 p-2 text-success">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Caixa Aberto</h3>
                <Badge>Ativo</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Operador:{" "}
                  <span className="text-foreground">
                    {openSession.operator_name ?? operatorName}
                  </span>
                </span>
                <span>
                  Aberto em:{" "}
                  <span className="text-foreground">{openedAt}</span>
                </span>
                <span>
                  Valor inicial:{" "}
                  <span className="text-foreground tabular-nums">
                    {formatCurrency(opening)}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMovement("cash_in")}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" /> Suprimento
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMovement("cash_out")}
              className="gap-2"
            >
              <MinusCircle className="h-4 w-4" /> Sangria
            </Button>
            <Button size="sm" onClick={() => setClosing(true)} className="gap-2">
              <DoorOpen className="h-4 w-4" /> Fechar Caixa
            </Button>
          </div>
        </div>
      </Card>

      <MovementDialog
        open={movement !== null}
        onOpenChange={(o) => !o && setMovement(null)}
        type={movement ?? "cash_in"}
        session={openSession}
        companyId={companyId}
        createdBy={operatorId}
      />
      <CloseSessionDialog
        open={closing}
        onOpenChange={setClosing}
        session={openSession}
        companyName={companyName ?? "NexOS"}
        onClosed={() => setClosing(false)}
      />
    </>
  );
}
