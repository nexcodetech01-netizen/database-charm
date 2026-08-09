import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  ClipboardList,
  DoorOpen,
  MinusCircle,
  PlusCircle,
  Printer,
  Wallet,
} from "lucide-react";
import { PageLayout } from "@/components/layout";
import { KpiCard } from "@/components/layout/kpi-card";
import { KpiSection } from "@/components/layout/kpi-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TestSaleBadge } from "@/features/sales";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import {
  useCashSessions,
  useCashSummary,
  useOpenCashSession,
} from "../hooks/use-cash";
import { CASH_METHOD_LABEL, type CashPaymentMethodKey } from "../types";
import { isSessionStale, staleSessionMessage } from "../lib/session-day";
import { OpenSessionDialog } from "./open-session-dialog";
import { MovementDialog } from "./movement-dialog";
import { CloseSessionDialog } from "./close-session-dialog";
import { ReportDialog } from "./report-dialog";
import { CashHelpCard } from "./cash-help-card";
import { useAccounts } from "@/features/finance/hooks/use-finance";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";


import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";

interface Props {
  companyId: string;
  companyName: string;
  operatorId: string;
  operatorName: string;
}

const METHOD_ORDER: CashPaymentMethodKey[] = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "payment_link",
];

export function CashWorkspace({
  companyId,
  companyName,
  operatorId,
  operatorName,
}: Props) {
  const { data: openSession, isLoading } = useOpenCashSession(companyId, operatorId);
  const { data: sessions } = useCashSessions(companyId);
  // Isolamento de homologação — por padrão as vendas de teste ficam ocultas.
  const [hideTestSales, setHideTestSales] = useState(true);
  const { data: summary } = useCashSummary(openSession, !hideTestSales);
  const { data: financialAccounts, isLoading: accountsLoading } = useAccounts(companyId);

  const hasActiveAccount = (financialAccounts ?? []).some(
    (a) => a.status === "active",
  );
  const accountsBlocked = !accountsLoading && !hasActiveAccount;
  const NO_ACCOUNT_MESSAGE =
    "Nenhuma conta financeira ativa encontrada. Cadastre uma conta em Financeiro > Contas Financeiras.";

  const [openDialog, setOpenDialog] = useState(false);
  const [movement, setMovement] = useState<"cash_in" | "cash_out" | null>(null);
  const [closing, setClosing] = useState(false);
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);

  const sessionStale = isSessionStale(openSession);


  const closedSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.status === "closed"),
    [sessions],
  );

  const bellaHint = useMemo(() => {
    if (!openSession || !summary) return null;
    const total = summary.salesTotal;
    if (total > 0) {
      let topKey: CashPaymentMethodKey = "cash";
      let topTotal = 0;
      for (const k of METHOD_ORDER) {
        const t = summary.byMethod[k]?.total ?? 0;
        if (t > topTotal) { topTotal = t; topKey = k; }
      }
      if (topTotal > 0) {
        const pct = Math.round((topTotal / total) * 100);
        return {
          title: `${CASH_METHOD_LABEL[topKey]} lidera hoje`,
          message: `${CASH_METHOD_LABEL[topKey]} representa ${pct}% das vendas do caixa (${formatCurrency(topTotal)} de ${formatCurrency(total)}).`,
          tone: "info" as const,
        };
      }
    }
    if (summary.expectedCash < 0) {
      return {
        title: "Atenção: Saldo de caixa negativo",
        message: "As sangrias superaram os suprimentos e vendas em dinheiro. Confira os lançamentos.",
        tone: "danger" as const,
      };
    }
    if ((summary.cashOut ?? 0) > (summary.cashIn ?? 0) + (summary.cashSales ?? 0)) {
      return {
        title: "Sangrias acima das entradas",
        message: "As sangrias do dia superam entradas + vendas em dinheiro. Confira antes do fechamento.",
        tone: "warning" as const,
      };
    }
    return null;
  }, [openSession, summary]);

  const lastClosedHint = useMemo(() => {
    const last = closedSessions[0];
    if (!last || openSession) return null;
    const diff = Number(last.difference ?? 0);
    if (Math.abs(diff) < 0.005) {
      return {
        title: "Último caixa fechado sem divergências",
        message: `Fechamento em ${last.closed_at ? new Date(last.closed_at).toLocaleString("pt-BR") : "—"}.`,
        tone: "info" as const,
      };
    }
    return {
      title: "Última divergência de caixa",
      message: `Diferença de ${formatCurrency(diff)} no fechamento anterior.`,
      tone: "danger" as const,
    };
  }, [closedSessions, openSession]);


  return (
    <PageLayout
      title="Fechamento de Caixa"
      description="Abertura, movimentações e conferência diária do caixa."
      icon={Wallet}
      actions={
        openSession ? (
          sessionStale ? (
            <Button onClick={() => setClosing(true)} className="gap-2">
              <DoorOpen className="h-4 w-4" /> Fechar caixa
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setMovement("cash_in")}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" /> Suprimento
              </Button>
              <Button
                variant="outline"
                onClick={() => setMovement("cash_out")}
                className="gap-2"
              >
                <MinusCircle className="h-4 w-4" /> Sangria
              </Button>
              <Button onClick={() => setClosing(true)} className="gap-2">
                <DoorOpen className="h-4 w-4" /> Fechar caixa
              </Button>
            </>
          )
        ) : (
          <Button
            onClick={() => {
              if (accountsBlocked) {
                toast.error(NO_ACCOUNT_MESSAGE);
                return;
              }
              setOpenDialog(true);
            }}
            className="gap-2"
            disabled={isLoading || accountsLoading || accountsBlocked}
          >
            <DoorOpen className="h-4 w-4" /> Abrir caixa
          </Button>
        )
      }

    >
      {accountsBlocked ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Financeiro não inicializado</AlertTitle>
          <AlertDescription>{NO_ACCOUNT_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}
      <CashHelpCard />
      {openSession ? (
        <>

          {sessionStale && (
            <BellaInlineSuggestion
              title="Caixa pendente de fechamento"
              message={staleSessionMessage(openSession)}
              tone="danger"
            />
          )}
          {!sessionStale && bellaHint && (
            <BellaInlineSuggestion
              title={bellaHint.title}
              message={bellaHint.message}
              tone={bellaHint.tone}
            />
          )}

          <KpiSection>
            <KpiCard
              label="Saldo inicial"
              value={formatCurrency(Number(openSession.opening_balance ?? 0))}
              icon={Wallet}
            />
            <KpiCard
              label="Vendas do caixa"
              value={formatCurrency(summary?.salesTotal ?? 0)}
              hint={`${summary?.salesCount ?? 0} venda(s)`}
              icon={Banknote}
            />
            <KpiCard
              label="Suprimentos"
              value={formatCurrency(summary?.cashIn ?? 0)}
              icon={PlusCircle}
            />
            <KpiCard
              label="Sangrias"
              value={formatCurrency(summary?.cashOut ?? 0)}
              icon={MinusCircle}
            />
          </KpiSection>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-test-sales"
                  checked={hideTestSales}
                  onCheckedChange={setHideTestSales}
                />
                <Label htmlFor="hide-test-sales" className="text-sm">
                  Ocultar vendas de teste
                </Label>
                {(summary?.testSalesCount ?? 0) > 0 ? (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                    {summary?.testSalesCount} de teste
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <span>
                  Produção:{" "}
                  <strong className="tabular-nums">
                    {formatCurrency(summary?.salesTotalProduction ?? 0)}
                  </strong>
                </span>
                <span className="text-warning">
                  Homologação:{" "}
                  <strong className="tabular-nums">
                    {formatCurrency(summary?.salesTotalTest ?? 0)}
                  </strong>
                </span>
                <span>
                  Total geral:{" "}
                  <strong className="tabular-nums">
                    {formatCurrency(summary?.salesTotalAll ?? 0)}
                  </strong>
                </span>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Resumo por forma de pagamento</h3>
                <p className="text-xs text-muted-foreground">
                  Dados apurados a partir das vendas pagas nesta sessão.
                </p>
              </div>
              <Badge variant="secondary">
                Dinheiro esperado: {formatCurrency(summary?.expectedCash ?? 0)}
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Qtde</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {METHOD_ORDER.map((k) => {
                  const row = summary?.byMethod[k] ?? { count: 0, total: 0 };
                  return (
                    <TableRow key={k}>
                      <TableCell>{CASH_METHOD_LABEL[k]}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {summary && summary.byMethod.other.count > 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Outros</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {summary.byMethod.other.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(summary.byMethod.other.total)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Movimentações do caixa</h3>
            {summary && summary.movements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={m.type === "cash_in" ? "default" : "destructive"}
                          >
                            {m.type === "cash_in" ? "Suprimento" : "Sangria"}
                          </Badge>
                          {summary.testMovementIds.includes(m.id) ? (
                            <TestSaleBadge compact />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{m.reason}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(m.amount ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum suprimento ou sangria registrado.
              </p>
            )}
          </Card>
        </>
      ) : (
        <>
          {lastClosedHint && (
            <BellaInlineSuggestion
              title={lastClosedHint.title}
              message={lastClosedHint.message}
              tone={lastClosedHint.tone}
            />
          )}
          <Card className="p-10 text-center">
            <Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Nenhum caixa aberto</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Abra o caixa para iniciar as operações do PDV. Apenas um caixa por operador
              pode permanecer aberto.
            </p>
          </Card>
        </>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Histórico de sessões</h3>
            <p className="text-xs text-muted-foreground">
              Últimas 30 sessões de caixa desta empresa — do mais recente para o mais antigo.
            </p>
          </div>
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </div>
        {(sessions?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead>Aberto</TableHead>
                  <TableHead>Fechado</TableHead>
                  <TableHead className="text-right">Inicial</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions ?? []).map((s) => {
                  const isClosed = s.status === "closed";
                  const diff = Number(s.difference ?? 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{s.operator_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.opened_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.opening_balance ?? 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.expected_cash != null ? formatCurrency(Number(s.expected_cash)) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.counted_cash != null ? formatCurrency(Number(s.counted_cash)) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          !isClosed
                            ? "text-muted-foreground"
                            : Math.abs(diff) < 0.005
                              ? "text-muted-foreground"
                              : diff > 0
                                ? "text-emerald-600"
                                : "text-destructive"
                        }`}
                      >
                        {isClosed ? formatCurrency(diff) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isClosed ? "secondary" : "default"}>
                          {isClosed ? "Fechado" : "Aberto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReportSessionId(s.id)}
                          className="gap-1"
                        >
                          <Printer className="h-3.5 w-3.5" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>


      <OpenSessionDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        companyId={companyId}
        operatorId={operatorId}
        operatorName={operatorName}
        onOpened={() => toast.success("Caixa aberto.")}
      />

      {openSession && (
        <>
          <MovementDialog
            open={movement !== null}
            onOpenChange={(o) => !o && setMovement(null)}
            type={movement ?? "cash_in"}
            sessionId={openSession.id}
            companyId={companyId}
            createdBy={operatorId}
          />
          <CloseSessionDialog
            open={closing}
            onOpenChange={setClosing}
            session={openSession}
            companyName={companyName}
            onClosed={(sessionId) => {
              setClosing(false);
              setReportSessionId(sessionId);
            }}
          />
        </>
      )}

      <ReportDialog
        sessionId={reportSessionId}
        companyName={companyName}
        onOpenChange={(o) => !o && setReportSessionId(null)}
      />
    </PageLayout>
  );
}
