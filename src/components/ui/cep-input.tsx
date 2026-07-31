import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MaskedInput } from "@/components/ui/masked-input";
import { MASKS, digits } from "@/lib/masks";
import { lookupCep, type CepAddress } from "@/lib/cep.service";
import { cn } from "@/lib/utils";

interface CepInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onAddressFound?: (address: CepAddress) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Input de CEP mascarado que consulta ViaCEP automaticamente ao completar 8 dígitos
 * e entrega o endereço via onAddressFound. Exibe toast quando o CEP não é
 * encontrado para orientar o preenchimento manual.
 */
export function CepInput({
  value,
  onValueChange,
  onAddressFound,
  placeholder = "00000-000",
  className,
  disabled,
  id,
}: CepInputProps) {
  const [loading, setLoading] = React.useState(false);
  const lastQueried = React.useRef<string>("");

  const handleChange = React.useCallback(
    async (next: string) => {
      onValueChange(next);
      const d = digits(next);
      if (d.length === 8 && d !== lastQueried.current) {
        lastQueried.current = d;
        setLoading(true);
        const address = await lookupCep(d);
        setLoading(false);
        if (address) {
          onAddressFound?.(address);
        } else {
          toast.warning("CEP não encontrado", {
            description: "Preencha o endereço manualmente.",
          });
        }
      }
    },
    [onValueChange, onAddressFound],
  );

  return (
    <div className={cn("relative", className)}>
      <MaskedInput
        id={id}
        mask={MASKS.cep}
        value={value}
        onValueChange={handleChange}
        placeholder={placeholder}
        disabled={disabled || loading}
      />
      {loading ? (
        <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}
