import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseCurrency } from "@/lib/masks";

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * Input de moeda BRL. Formata em pt-BR ao perder foco e emite `number`.
 * Durante a digitação aceita vírgula/ponto livremente.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, min, max, onBlur, onFocus, ...rest }, ref) => {
    const format = React.useCallback(
      (v: number) =>
        new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number.isFinite(v) ? v : 0),
      [],
    );

    const [display, setDisplay] = React.useState<string>(() => format(value ?? 0));
    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
      if (!focused) setDisplay(format(value ?? 0));
    }, [value, focused, format]);

    return (
      <Input
        {...rest}
        ref={ref}
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          setDisplay(raw);
          const parsed = parseCurrency(raw);
          const bounded =
            typeof min === "number" && parsed < min
              ? min
              : typeof max === "number" && parsed > max
                ? max
                : parsed;
          onValueChange(bounded);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          setDisplay(format(value ?? 0));
          onBlur?.(e);
        }}
        className={cn("tabular-nums text-right", className)}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
