import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyProductSearch } from "@/features/products/lib/product-search";
import type { PDVProductOption } from "../types";
import { handleBarcodeScan } from "../lib/barcode";

type Options = {
  companyId: string;
  /** `usePDV.addProduct` — o reducer incrementa a linha existente. */
  onProduct: (product: PDVProductOption) => void;
};

/**
 * usePdvBarcode — leitores USB (keyboard wedge) no PDV (Sprint 2.7).
 *
 * O leitor digita a sequência e envia ENTER. Aqui só acumulamos o buffer,
 * detectamos o ENTER e consultamos a busca existente (`applyProductSearch`).
 * Nenhuma query nova de negócio, nenhuma regra de produto duplicada.
 */
export function usePdvBarcode({ companyId, onProduct }: Options) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [buffer, setBuffer] = useState("");
  const [isScanning, setScanning] = useState(false);

  const lookup = useCallback(
    async (code: string) => {
      let q = supabase
        .from("products")
        .select("id,name,sku,barcode,price,cost,stock,unit")
        .eq("company_id", companyId)
        .eq("status", "active");
      q = applyProductSearch(q, code, { salesChannel: "loja_fisica" });
      const { data } = await q.limit(10);
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        barcode: (p as { barcode?: string | null }).barcode ?? null,
        price: p.price != null ? Number(p.price) : null,
        cost: p.cost != null ? Number(p.cost) : null,
        stock: p.stock != null ? Number(p.stock) : null,
        unit: p.unit ?? null,
      }));
    },
    [companyId],
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const scan = useCallback(
    async (raw: string) => {
      if (isScanning) return;
      setScanning(true);
      try {
        await handleBarcodeScan(raw, {
          lookup,
          onProduct,
          onNotFound: (message) => toast.error(message),
          clearBuffer: () => setBuffer(""),
          focusInput,
        });
      } finally {
        setScanning(false);
      }
    },
    [focusInput, isScanning, lookup, onProduct],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void scan(event.currentTarget.value);
    },
    [scan],
  );

  return {
    inputRef,
    buffer,
    setBuffer,
    onKeyDown,
    scan,
    isScanning,
    focusInput,
  };
}
