import { CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface NextAction {
  label: string;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  onClick?: () => void;
}

export interface NextActionPayload {
  title: string;
  summary?: string[];
  question?: string;
  primaryAction: NextAction;
  secondaryActions?: NextAction[];
}

interface Props extends NextActionPayload {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ActionButton({
  action,
  variant,
  onDone,
  autoFocus,
}: {
  action: NextAction;
  variant: "default" | "outline" | "ghost";
  onDone: () => void;
  autoFocus?: boolean;
}) {
  const handleClick = () => {
    action.onClick?.();
    onDone();
  };

  if (action.to) {
    const linkProps = {
      to: action.to,
      params: action.params,
      search: action.search,
      onClick: handleClick,
    } as unknown as React.ComponentProps<typeof Link>;
    return (
      <Button asChild variant={variant} autoFocus={autoFocus}>
        <Link {...linkProps}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={handleClick} autoFocus={autoFocus}>
      {action.label}
    </Button>
  );
}

export function NextActionDialog({
  open,
  onOpenChange,
  title,
  summary,
  question = "Qual o próximo passo?",
  primaryAction,
  secondaryActions = [],
}: Props) {
  const close = () => onOpenChange(false);
  const secondaries = secondaryActions.slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          {summary && summary.length > 0 ? (
            <DialogDescription asChild>
              <ul className="mx-auto mt-1 max-w-xs space-y-1 text-left text-sm text-muted-foreground">
                {summary.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <p className="text-center text-sm font-medium text-foreground">{question}</p>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <ActionButton action={primaryAction} variant="default" onDone={close} autoFocus />
          {secondaries.map((action, i) => (
            <ActionButton key={i} action={action} variant="outline" onDone={close} />
          ))}
          <Button variant="ghost" onClick={close} className="text-muted-foreground">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
