import * as React from "react";
import { IMaskInput } from "react-imask";
import { cn } from "@/lib/utils";
import { MASKS } from "@/lib/masks";

type MaskArrayItem = { mask: string };

interface MaskedInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "defaultValue"> {
  /**
   * Máscara única (string) ou lista de máscaras para dispatch dinâmico.
   * Ao passar uma lista, o react-imask escolhe a máscara compatível com o
   * comprimento digitado — usado por documentos que alternam entre CPF/CNPJ.
   */
  mask: string | MaskArrayItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Quando true, dispara onValueChange apenas com o valor sem máscara. */
  unmasked?: boolean;
}

/** Lista pré-definida para CPF (≤11 dígitos) ou CNPJ (>11 dígitos). */
export const CPF_CNPJ_MASK: MaskArrayItem[] = [
  { mask: MASKS.cpf },
  { mask: MASKS.cnpj },
];

/**
 * Lista pré-definida para telefone fixo (10 dígitos) ou celular (11 dígitos).
 * O react-imask escolhe automaticamente a máscara compatível com o comprimento,
 * permitindo digitar até o 11º dígito sem truncar.
 */
export const PHONE_MASK: MaskArrayItem[] = [
  { mask: MASKS.phone },
  { mask: MASKS.cell },
];

/**
 * Input com máscara (react-imask) usando os mesmos estilos base do Input do design system.
 * Emite string via onValueChange (mantém componente controlado sem depender de Controller).
 *
 * Suporta máscara dinâmica: ao passar um array de máscaras, o react-imask
 * seleciona automaticamente a máscara mais adequada conforme a digitação
 * ou colagem, mantendo o cursor estável.
 */
export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ className, mask, value, onValueChange, unmasked, ...rest }, ref) => {
    const maskProp = Array.isArray(mask) ? (mask as unknown as string) : mask;
    return (
      <IMaskInput
        {...rest}
        mask={maskProp}
        value={value ?? ""}
        unmask={unmasked ? true : false}
        onAccept={(val: unknown) => onValueChange(String(val ?? ""))}
        inputRef={ref as React.Ref<HTMLInputElement>}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm tabular-nums",
          className,
        )}
      />
    );
  },
);
MaskedInput.displayName = "MaskedInput";
