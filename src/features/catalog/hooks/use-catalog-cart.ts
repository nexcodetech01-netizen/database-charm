import { useCallback, useEffect, useState } from "react";

export interface CatalogCartItem {
  productId: string;
  name: string;
  price: number;
  reference: string;
  quantity: number;
}

function storageKey(slug: string) {
  return `nexos-catalogo-carrinho-${slug}`;
}

/**
 * Carrinho do catálogo público — só no navegador do cliente (sessionStorage),
 * sem nenhum vínculo com login ou banco de dados. O pedido final vira uma
 * única mensagem de WhatsApp com tudo que a pessoa escolheu, em vez de uma
 * mensagem separada por produto.
 */
export function useCatalogCart(slug: string) {
  const key = storageKey(slug);
  const [items, setItems] = useState<CatalogCartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as CatalogCartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(items));
    } catch {
      // sessionStorage indisponível (modo privado etc.) — carrinho só não persiste entre reloads.
    }
  }, [key, items]);

  const addItem = useCallback((item: Omit<CatalogCartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === item.productId);
      if (existing) {
        return prev.map((it) =>
          it.productId === item.productId ? { ...it, quantity: it.quantity + quantity } : it,
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((it) => it.productId !== productId);
      return prev.map((it) => (it.productId === productId ? { ...it, quantity } : it));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const isInCart = useCallback(
    (productId: string) => items.some((it) => it.productId === productId),
    [items],
  );

  const totalItems = items.reduce((acc, it) => acc + it.quantity, 0);
  const totalValue = items.reduce((acc, it) => acc + it.price * it.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clear, isInCart, totalItems, totalValue };
}

export function buildCartWhatsAppMessage(
  items: CatalogCartItem[],
  collectionUrl: string,
  formatCurrency: (v: number) => string,
): string {
  const lines = ["Olá!", "", "Tenho interesse nestes produtos:", ""];
  for (const item of items) {
    const ref = item.reference ? ` (${item.reference})` : "";
    lines.push(`• ${item.quantity}x ${item.name}${ref} — ${formatCurrency(item.price * item.quantity)}`);
  }
  const total = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  lines.push("", `Total: ${formatCurrency(total)}`, "", `Link do catálogo: ${collectionUrl}`, "", "Gostaria de fechar o pedido.");
  return lines.join("\n");
}

export function buildCartWhatsAppUrl(
  phone: string,
  items: CatalogCartItem[],
  collectionUrl: string,
  formatCurrency: (v: number) => string,
): string {
  const message = buildCartWhatsAppMessage(items, collectionUrl, formatCurrency);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
