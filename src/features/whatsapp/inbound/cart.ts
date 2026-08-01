/**
 * Pedido conversacional da Bella (WhatsApp inbound).
 *
 * Camada PURA: interpreta a intenção de adicionar/remover/ver o pedido e
 * formata as mensagens. NÃO cria venda, não altera estoque, preço, cadastro
 * nem qualquer motor do ERP — o pedido vive apenas no estado da conversa.
 */
import { normalize } from "./catalog-nav";
import type { ProductSearchItem } from "./product-search";

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  qty: number;
}

export type CartCommand =
  | { kind: "view" }
  | { kind: "clear" }
  | { kind: "remove"; text: string }
  | null;

const VIEW_RE =
  /\b(ver|meu|mostrar?|qual)\s+(o\s+)?(pedido|carrinho|sacola)\b|^\s*(pedido|carrinho|sacola)\s*$/;
const CLEAR_RE =
  /\b(limpar|zerar|cancelar|esvaziar|apagar)\s+(o\s+|meu\s+)?(pedido|carrinho|sacola)\b/;
const REMOVE_RE =
  /\b(remover|remove|tirar?|tire|retirar|excluir)\s+(o\s+|a\s+|os\s+|as\s+)?(.+)$/;

const ADD_RE =
  /\b(quero|queria|vou querer|me ve|me da|adiciona(r)?|inclui(r)?|coloca(r)?|manda|pode ser|leva(r)?)\b/;

/** Quantidade explícita: "2 bolsas", "adiciona 3 ...", "x2". */
export function parseQuantity(text: string): number {
  const t = normalize(text);
  const words: Record<string, number> = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  };
  const digits = t.match(/(?:^|\s)x?\s*(\d{1,2})(?:\s|$)/);
  if (digits) {
    const n = Number(digits[1]);
    if (n >= 1 && n <= 99) return n;
  }
  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(t) && n > 1) return n;
  }
  return 1;
}

export function parseCartCommand(text: string): CartCommand {
  const t = normalize(text);
  if (!t) return null;
  if (CLEAR_RE.test(t)) return { kind: "clear" };
  if (VIEW_RE.test(t)) return { kind: "view" };
  const rm = t.match(REMOVE_RE);
  if (rm?.[3]) return { kind: "remove", text: rm[3].trim() };
  return null;
}

const STOP = new Set([
  "quero", "queria", "vou", "me", "ve", "da", "de", "do", "da", "das", "dos",
  "o", "a", "os", "as", "um", "uma", "adicionar", "adiciona", "incluir",
  "inclui", "colocar", "coloca", "manda", "pode", "ser", "levar", "leva",
  "por", "favor", "e", "com", "no", "na", "pedido", "carrinho", "sacola",
]);

function tokens(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
}

/**
 * Casa a mensagem com UM produto ativo. Retorna `null` quando não há certeza
 * (nenhum ou vários candidatos igualmente prováveis).
 */
export function matchProduct(
  text: string,
  products: readonly ProductSearchItem[],
): ProductSearchItem | null {
  const t = normalize(text);
  if (!t || products.length === 0) return null;

  const contained = products.filter((p) => {
    const n = normalize(p.name);
    return n.length >= 3 && t.includes(n);
  });
  if (contained.length > 0) {
    return contained.sort((a, b) => b.name.length - a.name.length)[0]!;
  }

  const words = tokens(text);
  if (words.length === 0) return null;

  let best: { product: ProductSearchItem; score: number }[] = [];
  for (const product of products) {
    const nameWords = new Set(tokens(product.name));
    if (nameWords.size === 0) continue;
    let hits = 0;
    for (const w of words) if (nameWords.has(w)) hits += 1;
    if (hits === 0) continue;
    const score = hits / nameWords.size + hits / words.length;
    best.push({ product, score });
  }
  if (best.length === 0) return null;
  best.sort((a, b) => b.score - a.score);
  const top = best[0]!;
  // Exige cobertura razoável do nome do produto e ausência de empate.
  if (top.score < 1) return null;
  if (best[1] && best[1].score === top.score) return null;
  return top.product;
}

export function hasAddIntent(text: string): boolean {
  return ADD_RE.test(normalize(text));
}

export function addToCart(
  cart: readonly CartLine[] | null | undefined,
  product: ProductSearchItem,
  qty = 1,
): CartLine[] {
  const lines = [...(cart ?? [])];
  const idx = lines.findIndex((l) => l.productId === product.id);
  if (idx >= 0) {
    lines[idx] = { ...lines[idx]!, qty: lines[idx]!.qty + qty };
  } else {
    lines.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
    });
  }
  return lines;
}

export function removeFromCart(
  cart: readonly CartLine[] | null | undefined,
  text: string,
): { cart: CartLine[]; removed: CartLine | null } {
  const lines = [...(cart ?? [])];
  const t = normalize(text);
  const idx = lines.findIndex((l) => {
    const n = normalize(l.name);
    return n === t || n.includes(t) || t.includes(n);
  });
  if (idx < 0) return { cart: lines, removed: null };
  const [removed] = lines.splice(idx, 1);
  return { cart: lines, removed: removed ?? null };
}

export function cartTotal(cart: readonly CartLine[] | null | undefined): number {
  return (cart ?? []).reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCartLines(cart: readonly CartLine[]): string[] {
  return cart.map((l) =>
    l.qty > 1
      ? `• ${l.name} — ${l.qty}x ${money(l.price)} = ${money(l.price * l.qty)}`
      : `• ${l.name} — ${money(l.price)}`,
  );
}

/** Bloco padrão "🛍️ Pedido atual" + total. */
export function formatCartBlock(cart: readonly CartLine[]): string {
  return [
    "🛍️ *Pedido atual*",
    ...formatCartLines(cart),
    "",
    `*Total: ${money(cartTotal(cart))}*`,
  ].join("\n");
}

export function formatAddedMessage(cart: readonly CartLine[]): string {
  return [
    "Perfeito! 💕",
    "",
    "Adicionei ao seu pedido.",
    "",
    formatCartBlock(cart),
    "",
    "Você deseja ver mais algum produto?",
  ].join("\n");
}

export function formatCartMessage(cart: readonly CartLine[]): string {
  if (cart.length === 0) {
    return [
      "Seu pedido ainda está vazio. 🛍️",
      "",
      "_Digite *catálogo* para ver os produtos._",
    ].join("\n");
  }
  return [
    formatCartBlock(cart),
    "",
    "_Digite *finalizar* para concluir ou o nome de outro produto para adicionar._",
  ].join("\n");
}

export function formatRemovedMessage(
  removed: CartLine | null,
  cart: readonly CartLine[],
): string {
  if (!removed) {
    return "Não encontrei esse item no seu pedido. Pode me dizer o nome do produto?";
  }
  if (cart.length === 0) {
    return `Removi *${removed.name}*. Seu pedido está vazio agora. 🛍️`;
  }
  return [`Removi *${removed.name}*.`, "", formatCartBlock(cart)].join("\n");
}

export function formatClearedMessage(): string {
  return "Pronto, limpei seu pedido. 🛍️\n\n_Digite *catálogo* quando quiser recomeçar._";
}
