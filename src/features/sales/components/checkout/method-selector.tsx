import { memo } from "react";
import { cn } from "@/lib/utils";
import type { CheckoutMethodOption } from "./methods";
import type { UiCheckoutMethod } from "./types";

interface MethodSelectorProps {
    method: UiCheckoutMethod;
  methods: readonly CheckoutMethodOption[];
  /** Bloqueia a troca enquanto há cobrança gerada aguardando pagamento. */
  locked: boolean;
  onSelect: (method: UiCheckoutMethod) => void;
}

export const MethodSelector = memo(function MethodSelector({
    method,
  methods,
  locked,
  onSelect,
}: MethodSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {methods.map((m) => {
        const Icon = m.icon;
        const active = method === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(m.id)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition",
              active
                ? "border-primary bg-blue-600/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50 hover:bg-muted/40",
              locked ? "opacity-60" : "",
            )}
          >
            <div
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-md",
                active ? "bg-blue-600 text-gray-100-foreground" : "bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{m.label}</div>
              <div className="text-[11px] text-muted-foreground">{m.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
