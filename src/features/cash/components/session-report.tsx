import { formatCurrency } from "@/lib/format";
import { CASH_METHOD_LABEL, type CashPaymentMethodKey, type CashSession, type CashSummary } from "../types";

function methodLabel(raw: string | null): string {
  if (!raw) return "Outro";
  if (raw === "card") return CASH_METHOD_LABEL.credit_card;
  if (raw === "bella_pay") return CASH_METHOD_LABEL.pix;
  if ((["cash","pix","credit_card","debit_card","payment_link"] as string[]).includes(raw)) {
    return CASH_METHOD_LABEL[raw as CashPaymentMethodKey];
  }
  return "Outro";
}

interface Props {
  session: CashSession;
  summary: CashSummary;
  companyName: string;
}

const METHOD_ORDER: CashPaymentMethodKey[] = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "payment_link",
];

/**
 * Relatório de fechamento — apresentável na tela e otimizado para impressão
 * via `window.print()`. Somente leitura; nenhum cálculo novo aqui.
 */
export function SessionReport({ session, summary, companyName }: Props) {
  const diff = Number(session.difference ?? 0);
  return (
    <div className="receipt-print-area">
      <div className="receipt space-y-3 rounded-md border bg-background p-4 text-sm">
        <header className="text-center">
          <div className="text-base font-semibold">{companyName}</div>
          <div className="text-xs text-muted-foreground">Relatório de Fechamento de Caixa</div>
        </header>

        <section className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Line label="Operador" value={session.operator_name ?? "—"} />
          <Line
            label="Aberto em"
            value={new Date(session.opened_at).toLocaleString("pt-BR")}
          />
          <Line
            label="Fechado em"
            value={
              session.closed_at
                ? new Date(session.closed_at).toLocaleString("pt-BR")
                : "—"
            }
          />
          <Line label="Status" value={session.status === "closed" ? "Fechado" : "Aberto"} />
        </section>

        <hr />

        <section>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider">
            Vendas
          </div>
          <Line label="Quantidade" value={String(summary.salesCount)} />
          <Line label="Valor total" value={formatCurrency(summary.salesTotal)} />
        </section>

        <section>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider">
            Resumo por forma
          </div>
          {METHOD_ORDER.map((k) => (
            <Line
              key={k}
              label={CASH_METHOD_LABEL[k]}
              value={`${summary.byMethod[k].count}x  ${formatCurrency(summary.byMethod[k].total)}`}
            />
          ))}
          {summary.byMethod.other.count > 0 && (
            <Line
              label="Outros"
              value={`${summary.byMethod.other.count}x  ${formatCurrency(summary.byMethod.other.total)}`}
            />
          )}
        </section>

        <section>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider">
            Caixa
          </div>
          <Line label="Saldo inicial" value={formatCurrency(summary.openingBalance)} />
          <Line label="Suprimentos" value={formatCurrency(summary.cashIn)} />
          <Line label="Sangrias" value={`- ${formatCurrency(summary.cashOut)}`} />
          <Line label="Dinheiro recebido (vendas e cobranças)" value={formatCurrency(summary.cashSales)} />
          <Line
            label="Dinheiro esperado"
            value={formatCurrency(Number(session.expected_cash ?? summary.expectedCash))}
          />
          {session.counted_cash != null && (
            <>
              <Line
                label="Dinheiro contado"
                value={formatCurrency(Number(session.counted_cash))}
              />
              <Line label="Diferença" value={formatCurrency(diff)} />
            </>
          )}
        </section>

        {summary.sales.length > 0 && (
          <section>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider">
              Vendas vinculadas ({summary.sales.length})
            </div>
            <ul className="space-y-1 text-xs">
              {summary.sales.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground">
                    {s.paid_at ? new Date(s.paid_at).toLocaleString("pt-BR") : "—"}
                    {" · "}
                    {methodLabel(s.payment_method)}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(s.grand_total)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}


        {summary.movements.length > 0 && (
          <section>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider">
              Movimentações
            </div>
            <ul className="space-y-1 text-xs">
              {summary.movements.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2">
                  <span>
                    [{m.type === "cash_in" ? "SUP" : "SAN"}] {m.reason}
                    {m.note ? ` — ${m.note}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(Number(m.amount ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {session.closing_note && (
          <section className="text-xs">
            <div className="font-medium">Observação</div>
            <div className="text-muted-foreground">{session.closing_note}</div>
          </section>
        )}

        <footer className="pt-2 text-center text-[10px] text-muted-foreground">
          Documento não fiscal • NexOS
        </footer>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
