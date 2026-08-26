import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  DISPLAY_STATUS_LABEL,
  DISPLAY_STATUS_TONE,
  type DisplayStatus,
} from "../lib/receivables";
import type { TransactionStatus } from "../types";

// Mapa legado (usado quando não há derivação): pending/paid/overdue/cancelled.
const LEGACY: Record<TransactionStatus, DisplayStatus> = {
  paid: "paid",
  pending: "pending",
  overdue: "overdue",
  cancelled: "cancelled",
};

interface Props {
  /** Aceita tanto DisplayStatus quanto TransactionStatus. */
  status: string;
  /** Valor já recebido/pago — mostrado só quando status é "partial". */
  receivedAmount?: number;
  /** Dias em atraso — mostrado só quando status é "overdue". Antes essa
   * informação aparecia REPETIDA (embaixo da data E aqui no badge) —
   * agora fica só num lugar. */
  overdueDays?: number;
}

export function TransactionStatusBadge({ status, receivedAmount, overdueDays }: Props) {
  const display =
    (status as DisplayStatus) in DISPLAY_STATUS_LABEL
      ? (status as DisplayStatus)
      : (LEGACY[status as TransactionStatus] ?? "pending" as DisplayStatus);
  const showReceived = display === "partial" && receivedAmount != null && receivedAmount > 0;
  const showOverdue = display === "overdue" && overdueDays != null && overdueDays > 0;
  return (
    <Badge variant="outline" className={DISPLAY_STATUS_TONE[display]}>
      {DISPLAY_STATUS_LABEL[display]}
      {showReceived ? ` · ${formatCurrency(receivedAmount)} recebido` : ""}
      {showOverdue ? ` · ${overdueDays}${overdueDays === 1 ? " dia" : " dias"}` : ""}
    </Badge>
  );
}
