import { StatusBadge } from "@/components/design";
import { INTEREST_STATUS_LABEL, type InterestStatus } from "../types";

const TONE: Record<InterestStatus, string> = {
  aguardando: "warning",
  disponivel: "success",
  avisado: "info",
  concluido: "neutral",
  cancelado: "danger",
};

export function InterestStatusBadge({ status }: { status: InterestStatus }) {
  return <StatusBadge status={TONE[status]} label={INTEREST_STATUS_LABEL[status]} />;
}
