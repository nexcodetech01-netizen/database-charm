import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFiscalArtifact } from "@/features/fiscal/v2/hooks/use-fiscal";
import { printPdfUrl } from "../lib/printer";

interface Props {
  /** Caminho do PDF da DANFE no storage fiscal. */
  path: string | null | undefined;
  /** Rótulo do botão — muda para "Reimprimir" após a primeira impressão. */
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
}

/**
 * Impressão da DANFE NFC-e direto do PDV (Sprint 4.0).
 * Consome o artefato já persistido pelo motor fiscal — nada é reemitido.
 */
export function DanfePrintButton({
  path,
  label,
  variant = "default",
  size = "sm",
}: Props) {
  const artifact = useFiscalArtifact();
  const [printed, setPrinted] = useState(false);
  const disabled = !path || artifact.isPending;

  async function handleClick() {
    if (!path) return;
    try {
      const { url } = await artifact.mutateAsync(path);
      printPdfUrl(url);
      setPrinted(true);
    } catch {
      toast.error("Não foi possível abrir a DANFE para impressão.");
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={disabled}>
      <Printer className="mr-1.5 h-4 w-4" />
      {label ?? (printed ? "Reimprimir DANFE NFC-e" : "Imprimir DANFE NFC-e")}
    </Button>
  );
}
