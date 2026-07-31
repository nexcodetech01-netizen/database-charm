import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useOpenCashSession } from "../hooks/use-cash";

const REMINDER_HOUR = 19;
const REMINDER_MINUTE = 15;
const CONFIRM_HOUR = 19;
const CONFIRM_MINUTE = 30;

function nowMinutes(d: Date = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Banner + beforeunload confirmation lembrando o operador de fechar o caixa
 * do dia. Aparece a partir das 19:15 quando há uma sessão de caixa aberta
 * hoje. A partir das 19:30 intercepta a saída da aba com um confirm nativo.
 */
export function CashClosingReminder({
  companyId,
  operatorId,
}: {
  companyId: string;
  operatorId: string;
}) {
  const { data: session } = useOpenCashSession(companyId, operatorId);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);

  // Re-avalia a cada minuto para acender o banner sem precisar recarregar.
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const now = new Date();
  const openedToday =
    !!session?.opened_at && isSameDay(new Date(session.opened_at), now);
  const minutes = nowMinutes(now);
  const showBanner =
    !dismissed &&
    session?.status === "open" &&
    openedToday &&
    minutes >= REMINDER_HOUR * 60 + REMINDER_MINUTE;

  const shouldWarnOnExit =
    session?.status === "open" &&
    openedToday &&
    minutes >= CONFIRM_HOUR * 60 + CONFIRM_MINUTE;

  useEffect(() => {
    if (!shouldWarnOnExit) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Mensagem customizada é ignorada por navegadores modernos; o browser
      // exibe seu próprio prompt de confirmação.
      event.returnValue =
        "O caixa de hoje ainda não foi fechado. Deseja realmente sair?";
      return event.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarnOnExit]);

  // Suprime o warning do lint sobre `tick` sem uso direto — ele existe só
  // para forçar re-render a cada minuto.
  void tick;

  if (!showBanner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm">
          <span aria-hidden="true">⏰ </span>
          <span className="font-medium">Lembrete:</span> não se esqueça de
          realizar o fechamento do caixa de hoje!
        </p>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button size="sm" asChild className="gap-1.5">
          <Link to={ROUTES.cash}>
            <AlertTriangle className="h-4 w-4" />
            Fechar caixa agora
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dispensar lembrete"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
