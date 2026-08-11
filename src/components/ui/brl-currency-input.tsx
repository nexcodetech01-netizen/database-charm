import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BRLCurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Input de moeda BRL (R$) profissional.
 * Formata em tempo real: ao digitar 4400, exibe R$ 44,00.
 */
export const BRLCurrencyInput = React.forwardRef<HTMLInputElement, BRLCurrencyInputProps>(
  ({ value, onValueChange, className, disabled, ...rest }, ref) => {
    const format = (val: number | undefined | null) => {
      const safeValue = typeof val === "number" ? val : 0;
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(safeValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      
      // Remove tudo que não for dígito
      const rawValue = e.target.value.replace(/\D/g, "");
      
      // Converte para centavos (número float)
      const numericValue = parseInt(rawValue || "0", 10) / 100;
      
      onValueChange(numericValue);
    };

    return (
      <Input
        {...rest}
        ref={ref}
        disabled={disabled}
        inputMode="numeric"
        value={format(value ?? 0)}
        onChange={handleChange}
        className={cn("tabular-nums font-medium", className)}
      />
    );
  }
);

BRLCurrencyInput.displayName = "BRLCurrencyInput";
