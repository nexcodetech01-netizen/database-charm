import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, ChevronDown, FileUp, Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { financeService, useAccounts, useFinancialCategories } from "@/features/finance";
import { extractPdfRows } from "../lib/pdf-rows";
import { parseNubankStatement, type ParsedStatement, type StatementEntry } from "../lib/nubank-statement";
import { analyzeStatement, type Analysis } from "../lib/analyze";
import type { SystemMove } from "../lib/match";
import { addDays, bankReconciliationService as svc, type StoredLine } from "../services/bank-reconciliation.service";
import { LaunchEntryDialog, type AccountLite, type CategoryLite } from "./launch-entry-dialog";

type Move = SystemMove & { paymentMethod: string | null };

function br(day: string | null | undefined) {
  if (!day) return "—";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function Amount({ direction, value }: { direction: "in" | "out"; value: number }) {
  return (
    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", direction === "in" ? "text-status-success" : "text-foreground")}>
      {direction === "in" ? "+" : "−"} {formatCurrency(value)}
    </span>
  );
}

export function BankReconciliationDialog({
  companyId,
  open,
  onOpenChange,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: accountsData = [] } = useAccounts(companyId);
  const { data: categoriesData = [] } = useFinancialCategories(companyId);
  const accounts = useMemo(
    () => (accountsData as (AccountLite & { status: string; current_balance: number })[]).filter((a) => a.status === "active"),
    [accountsData],
  );
  const categories = categoriesData as unknown as CategoryLite[];

  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [fromDay, setFromDay] = useState("");
  const [lastMark, setLastMark] = useState<string | null>(null);
  const [lines, setLines] = useState<StoredLine[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [launching, setLaunching] = useState<{ entry: StatementEntry; hash: string } | null>(null);
  const [moving, setMoving] = useState<Move | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [showMatched, setShowMatched] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const account = accounts.find((a) => a.id === accountId);

  const analysis: Analysis | null = useMemo(() => {
    if (!statement || !fromDay) return null;
    return analyzeStatement({ statement, fromDay, storedLines: lines, moves, currentBalance: balance });
  }, [statement, fromDay, lines, moves, balance]);

  function reset() {
    setStatement(null);
    setFile(null);
    setLines([]);
    setMoves([]);
    setFromDay("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function loadData(day: string, st: ParsedStatement) {
    const [mv, ln, accs] = await Promise.all([
      svc.loadMoves(companyId, accountId, addDays(day, -3)),
      svc.loadLines(accountId, day),
      financeService.listAccounts(companyId),
    ]);
    const acc = (accs as { id: string; current_balance: number }[]).find((a) => a.id === accountId);
    setMoves(mv);
    setLines(ln);
    setBalance(acc ? Number(acc.current_balance) : null);

    const a = analyzeStatement({
      statement: st,
      fromDay: day,
      storedLines: ln,
      moves: mv,
      currentBalance: acc ? Number(acc.current_balance) : null,
    });
    if (a.matched.length > 0) {
      await svc.saveLines(
        companyId,
        accountId,
        a.matched.map((m) => ({
          line_hash: m.hash,
          entry_date: m.entry.date,
          direction: m.entry.direction,
          amount: m.entry.amount,
          description: m.entry.description,
          counterparty: m.entry.counterparty,
          status: "matched" as const,
          transaction_id: m.move.kind === "transaction" ? m.move.id : null,
          transfer_id: m.move.kind === "transfer" ? m.move.id : null,
        })),
      );
      setLines(await svc.loadLines(accountId, day));
    }
  }

  async function readStatement() {
    if (!file || !accountId) return;
    setLoading(true);
    try {
      const rows = await extractPdfRows(file);
      const st = parseNubankStatement(rows);
      if (st.entries.length === 0) {
        toast.error("Não reconheci movimentos nesse PDF. Ele precisa ser o extrato do Nubank PJ.");
        return;
      }
      const mark = await svc.lastMark(accountId);
      setLastMark(mark?.reconciled_until ?? null);
      const start = mark ? addDays(mark.reconciled_until, 1) : (st.periodStart ?? st.entries[0].date);
      setStatement(st);
      setFromDay(start);
      await loadData(start, st);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o extrato.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh(day = fromDay) {
    if (!statement) return;
    await loadData(day, statement);
    qc.invalidateQueries({ queryKey: ["finance"] });
  }

  async function changeFrom(day: string) {
    setFromDay(day);
    if (!day || !statement) return;
    setLoading(true);
    try {
      await loadData(day, statement);
    } finally {
      setLoading(false);
    }
  }

  async function saveLine(
    item: { entry: StatementEntry; hash: string },
    status: StoredLine["status"],
    link: { transaction_id?: string; transfer_id?: string } = {},
  ) {
    await svc.saveLines(companyId, accountId, [
      {
        line_hash: item.hash,
        entry_date: item.entry.date,
        direction: item.entry.direction,
        amount: item.entry.amount,
        description: item.entry.description,
        counterparty: item.entry.counterparty,
        status,
        transaction_id: link.transaction_id ?? null,
        transfer_id: link.transfer_id ?? null,
      },
    ]);
  }

  async function ignore(item: { entry: StatementEntry; hash: string }) {
    setBusyId(item.hash);
    try {
      await saveLine(item, "ignored");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ignorar.");
    } finally {
      setBusyId(null);
    }
  }

  async function undo(hash: string) {
    setBusyId(hash);
    try {
      await svc.removeLine(accountId, hash);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeMove(m: Move) {
    if (!window.confirm(`Excluir "${m.description}" (${formatCurrency(m.amount)})? O valor sai do saldo da conta.`)) return;
    setBusyId(m.id);
    try {
      await financeService.removeTransaction(m.id);
      toast.success("Lançamento excluído.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmMove() {
    if (!moving || !moveTarget) return;
    const m = moving;
    setBusyId(m.id);
    try {
      await financeService.reverseTransaction(m.id, "Conciliação do extrato: movido para outra conta");
      try {
        await financeService.settleTransaction(m.id, {
          paymentMethod: (m.paymentMethod ?? "pix") as never,
          accountId: moveTarget,
          paidAt: m.date,
        });
      } catch (e) {
        toast.error(
          `O lançamento foi tirado desta conta, mas não consegui dar baixa na outra: ${
            e instanceof Error ? e.message : ""
          }. Ele ficou em aberto no Financeiro — dê a baixa por lá.`,
        );
        throw e;
      }
      toast.success("Movido para a outra conta.");
      setMoving(null);
      setMoveTarget("");
      await refresh();
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("tirado desta conta"))) {
        toast.error(e instanceof Error ? e.message : "Não foi possível mover.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function launchAdjustment() {
    if (!analysis || analysis.difference === null || !statement?.periodEnd) return;
    const diff = analysis.difference;
    const ok = window.confirm(
      `Lançar um ajuste de ${formatCurrency(Math.abs(diff))} (${diff > 0 ? "saída" : "entrada"}) em ${br(
        statement.periodEnd,
      )} para o saldo do sistema ficar igual ao do banco?`,
    );
    if (!ok) return;
    setLoading(true);
    try {
      await financeService.createAndSettleTransaction(
        {
          company_id: companyId,
          type: diff > 0 ? "expense" : "income",
          description: `Ajuste de conciliação bancária (extrato até ${br(statement.periodEnd)})`,
          amount: Math.abs(diff),
          transaction_date: statement.periodEnd,
          due_date: statement.periodEnd,
          notes: "Diferença entre o saldo do sistema e o do extrato, lançada na conciliação.",
        } as never,
        { paymentMethod: "other", accountId, paidAt: statement.periodEnd },
      );
      toast.success("Ajuste lançado.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível lançar o ajuste.");
    } finally {
      setLoading(false);
    }
  }

  async function markReconciled() {
    if (!analysis || !statement?.periodEnd) return;
    try {
      await svc.addMark({
        companyId,
        accountId,
        reconciledUntil: statement.periodEnd,
        statementBalance: statement.closingBalance,
        systemBalance: analysis.systemBalanceAtEnd,
      });
      toast.success(`Conta conferida até ${br(statement.periodEnd)}.`);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  const pending = analysis ? analysis.bankOnly.length + analysis.systemOnly.length : 0;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          onOpenChange(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden p-4 sm:w-full sm:max-w-3xl sm:p-6 [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Conciliar extrato</DialogTitle>
            <DialogDescription>
              Suba o extrato em PDF do banco. O sistema compara com os lançamentos da conta e mostra o que falta lançar e o
              que está sobrando.
            </DialogDescription>
          </DialogHeader>

          {!statement ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Conta</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a conta do extrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Extrato (PDF do Nubank PJ)</Label>
                  <Input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">No app do Nubank: Extrato → ícone de compartilhar → escolha o período → PDF.</p>
              <DialogFooter>
                <Button onClick={readStatement} disabled={!accountId || !file || loading}>
                  {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" />}
                  Ler extrato
                </Button>
              </DialogFooter>
            </div>
          ) : analysis ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {account?.name} · extrato de {br(statement.periodStart)} a {br(statement.periodEnd)}
                  </p>
                  {analysis.statementReadOk ? (
                    <p className="flex items-center gap-1 text-xs text-status-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Extrato lido por completo ({statement.entries.length} movimentos,
                      saldos conferem)
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-status-warning">
                      <AlertTriangle className="h-3.5 w-3.5" /> Algum movimento pode não ter sido lido — confira com o PDF.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conferir a partir de</Label>
                  <Input
                    type="date"
                    className="h-8 w-40"
                    value={fromDay}
                    min={statement.periodStart ?? undefined}
                    max={statement.periodEnd ?? undefined}
                    onChange={(e) => void changeFrom(e.target.value)}
                  />
                </div>
              </div>
              {lastMark ? (
                <p className="-mt-3 text-xs text-muted-foreground">
                  Esta conta já foi conferida até {br(lastMark)}; começando no dia seguinte.
                </p>
              ) : analysis.outOfScope > 0 ? (
                <p className="-mt-3 text-xs text-muted-foreground">
                  {analysis.outOfScope} movimento(s) antes de {br(fromDay)} não serão mexidos.
                </p>
              ) : null}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <p className="text-[11px] text-muted-foreground">Banco em {br(statement.periodEnd)}</p>
                  <p className="text-sm font-semibold tabular-nums sm:text-base">
                    {statement.closingBalance !== null ? formatCurrency(statement.closingBalance) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-[11px] text-muted-foreground">Sistema em {br(statement.periodEnd)}</p>
                  <p className="text-sm font-semibold tabular-nums sm:text-base">
                    {analysis.systemBalanceAtEnd !== null ? formatCurrency(analysis.systemBalanceAtEnd) : "—"}
                  </p>
                </div>
                <div className={cn("rounded-lg border p-2", analysis.difference === 0 ? "border-status-success/40" : "border-status-warning/50")}>
                  <p className="text-[11px] text-muted-foreground">Diferença</p>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums sm:text-base",
                      analysis.difference === 0 ? "text-status-success" : "text-status-warning",
                    )}
                  >
                    {analysis.difference !== null ? formatCurrency(analysis.difference) : "—"}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Atualizando…
                </div>
              ) : null}

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Só no banco · falta lançar ({analysis.bankOnly.length})
                </h3>
                {analysis.bankOnly.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nada faltando. 🎉</p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {analysis.bankOnly.map((b) => (
                      <li key={b.hash} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{b.entry.counterparty || b.entry.kind}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {br(b.entry.date)} · {b.entry.kind}
                            </p>
                          </div>
                          <Amount direction={b.entry.direction} value={b.entry.amount} />
                        </div>
                        <div className="ml-auto flex shrink-0 gap-1.5">
                          <Button size="sm" className="h-8" onClick={() => setLaunching(b)} disabled={busyId === b.hash}>
                            Lançar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => void ignore(b)}
                            disabled={busyId === b.hash}
                            title="Não lançar (ex.: já está registrado de outro jeito)"
                          >
                            Ignorar
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Só no sistema · não passou no banco ({analysis.systemOnly.length})
                </h3>
                {analysis.systemOnly.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nada sobrando.</p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {(analysis.systemOnly as Move[]).map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{m.description}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {br(m.date)}
                              {m.kind === "transfer" ? " · transferência" : m.source ? ` · ${sourceLabel(m.source)}` : ""}
                            </p>
                          </div>
                          <Amount direction={m.direction} value={m.amount} />
                        </div>
                        {m.kind === "transaction" ? (
                          <div className="ml-auto flex shrink-0 gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                setMoving(m);
                                setMoveTarget("");
                              }}
                              disabled={busyId === m.id}
                              title="Caiu em outra conta (ex.: conta pessoal)"
                            >
                              <ArrowLeftRight className="mr-1 h-3.5 w-3.5" /> Mover
                            </Button>
                            {m.source === "manual" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-destructive"
                                onClick={() => void removeMove(m)}
                                disabled={busyId === m.id}
                                title="Excluir (ex.: lançado em dobro)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  onClick={() => setShowMatched((s) => !s)}
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMatched && "rotate-180")} />
                  Bateu ({analysis.matched.length + analysis.done.filter((d) => d.status === "matched").length})
                </Button>
                {showMatched ? (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {analysis.matched.map((m) => (
                      <li key={m.hash} className="flex items-center gap-3 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{m.entry.counterparty || m.entry.kind}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {br(m.entry.date)} · no sistema: {m.move.description}
                          </p>
                        </div>
                        <Amount direction={m.entry.direction} value={m.entry.amount} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {analysis.done.length > 0 ? (
                <section className="space-y-2">
                  <Button
                    type="button"
                  variant="ghost"
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    onClick={() => setShowDone((s) => !s)}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
                    Já conferidos ({analysis.done.length})
                  </Button>
                  {showDone ? (
                    <ul className="divide-y overflow-hidden rounded-lg border">
                      {analysis.done.map((d) => (
                        <li key={d.hash} className="flex items-center gap-3 px-3 py-2">
                          <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                            {d.status === "matched" ? "bateu" : d.status === "created" ? "lançado" : "ignorado"}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{d.entry.counterparty || d.entry.kind}</p>
                            <p className="text-xs text-muted-foreground">{br(d.entry.date)}</p>
                          </div>
                          <Amount direction={d.entry.direction} value={d.entry.amount} />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            title="Desfazer conferência desta linha (não apaga lançamentos)"
                            onClick={() => void undo(d.hash)}
                            disabled={busyId === d.hash}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={reset}>
                  Outro extrato
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {analysis.difference !== null && analysis.difference !== 0 && pending === 0 ? (
                    <Button variant="outline" onClick={() => void launchAdjustment()} disabled={loading}>
                      Lançar ajuste de {formatCurrency(Math.abs(analysis.difference))}
                    </Button>
                  ) : null}
                  <Button onClick={() => void markReconciled()} disabled={loading}>
                    Marcar conferido até {br(statement.periodEnd)}
                  </Button>
                </div>
              </DialogFooter>
              {pending > 0 ? (
                <p className="text-right text-xs text-muted-foreground">
                  Resolva os {pending} itens acima antes de marcar como conferido — ou marque assim mesmo e continue na
                  próxima.
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <LaunchEntryDialog
        open={!!launching}
        onOpenChange={(o) => !o && setLaunching(null)}
        entry={launching?.entry ?? null}
        companyId={companyId}
        accountId={accountId}
        accounts={accounts}
        categories={categories}
        onDone={async (link) => {
          if (launching) await saveLine(launching, "created", link);
          await refresh();
        }}
      />

      <Dialog open={!!moving} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Mover para outra conta</DialogTitle>
            <DialogDescription>
              {moving ? `${moving.description} · ${formatCurrency(moving.amount)} · ${br(moving.date)}` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Em qual conta esse dinheiro {moving?.direction === "in" ? "entrou" : "saiu"} de verdade?</Label>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O valor sai do saldo de {account?.name} e entra no da conta escolhida, na mesma data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoving(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmMove()} disabled={!moveTarget || busyId === moving?.id}>
              {busyId === moving?.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function sourceLabel(source: string): string {
  switch (source) {
    case "sale":
      return "venda";
    case "purchase":
      return "compra";
    case "credit_payment":
      return "crediário";
    case "bella_pay":
      return "Bella Pay";
    case "manual":
      return "lançamento manual";
    default:
      return source;
  }
}
