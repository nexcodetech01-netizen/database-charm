import { Badge } from "@/components/ui/badge";
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
}

export function TransactionStatusBadge({ status }: Props) {
  const display =
    (status as DisplayStatus) in DISPLAY_STATUS_LABEL
      ? (status as DisplayStatus)
      : (LEGACY[status as TransactionStatus] ?? "pending");
  return (
    <Badge variant="outline" className={DISPLAY_STATUS_TONE[display]}>
      {DISPLAY_STATUS_LABEL[display]}
    </Badge>
  );
}
