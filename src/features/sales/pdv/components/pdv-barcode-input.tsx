import { ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePdvBarcode } from "../hooks/use-pdv-barcode";
import type { PDVProductOption } from "../types";

type Props = {
  companyId: string;
  onProduct: (product: PDVProductOption) => void;
};

/**
 * PDV — campo de leitura de código de barras (Sprint 2.7).
 * Reutiliza a busca única de produtos; o foco volta sozinho após cada leitura.
 */
export function PDVBarcodeInput({ companyId, onProduct }: Props) {
  const barcode = usePdvBarcode({ companyId, onProduct });

  return (
    <div className="rounded-xl border bg-background p-3">
      <Label htmlFor="pdv-barcode" className="text-xs text-muted-foreground">
        Leitor de código de barras
      </Label>
      <div className="relative mt-1.5">
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="pdv-barcode"
          ref={barcode.inputRef}
          autoFocus
          autoComplete="off"
          value={barcode.buffer}
          onChange={(e) => barcode.setBuffer(e.target.value)}
          onKeyDown={barcode.onKeyDown}
          placeholder="Bipe o produto (EAN-13, EAN-8, UPC ou SKU)"
          className="h-11 pl-9 font-mono text-base"
        />
      </div>
    </div>
  );
}
