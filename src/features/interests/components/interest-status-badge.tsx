import { StatusBadge } from "@/components/design";
import { INTEREST_STATUS_LABEL, type InterestStatus } from "../types";

const TONE: Record<InterestStatus, "warning" | "success" | "info" | "neutral" | "danger"> = {
  aguardando: "warning",
  disponivel: "success",
  avisado: "info",
  concluido: "neutral",
  cancelado: "danger",
};

export function InterestStatusBadge({ status }: { status: InterestStatus }) {
  return <StatusBadge tone={TONE[status]} label={INTEREST_STATUS_LABEL[status]} />;
}
