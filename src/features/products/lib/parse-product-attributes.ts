/**
 * Separa marca, estampa/modelo, cor e tamanho de um nome de produto escrito
 * em linha (como vem na lista do fornecedor ou no pedido importado):
 *
 *   "Camiseta Masculina Premium Nike Costas Just Do It Branca GG"
 *   → marca Nike · modelo "Costas Just Do It" · cor Branca · tamanho GG
 *
 * Só preenche o que reconhece com segurança; o resto fica em branco para a
 * pessoa completar. Nunca altera o nome.
 */
import { SIZE_SUGGESTIONS } from "./product-identity";

export interface ParsedAttributes {
  brand: string | null;
  model: string | null;
  color: string | null;
  size: string | null;
}

/** Marcas comuns em revenda de moda/acessórios (as da empresa somam a esta lista). */
export const KNOWN_BRANDS = [
  "Calvin Klein", "Emporio Armani", "Armani Exchange", "Armani", "Hugo Boss", "Boss",
  "Tommy Hilfiger", "Tommy", "Ralph Lauren", "Polo Ralph Lauren", "Lacoste", "Nike",
  "Adidas", "Puma", "Oakley", "Hurley", "Zara", "Cyclone", "Off-White", "Diesel",
  "Guess", "Michael Kors", "Louis Vuitton", "Gucci", "Prada", "Versace", "Dolce & Gabbana",
  "Balenciaga", "Burberry", "Fendi", "Givenchy", "Chanel", "Dior", "Coach", "Kate Spade",
  "Levi's", "Reserva", "Osklen", "Quiksilver", "Billabong", "Vans", "Converse",
  "New Balance", "Mizuno", "Fila", "Champion", "Supreme", "Hollister", "Abercrombie",
  "Aeropostale", "Element", "Volcom", "Red Bull", "Jordan",
];

/** Cores (as compostas primeiro, para "Azul Marinho" ganhar de "Azul"). */
export const KNOWN_COLORS = [
  "Azul Royal", "Azul Marinho", "Azul Bebê", "Azul Claro", "Azul Escuro", "Azul Petróleo",
  "Verde Militar", "Verde Musgo", "Verde Água", "Verde Bandeira", "Verde Claro", "Verde Escuro",
  "Café com Leite", "Off White", "Rosa Bebê", "Rosa Claro", "Cinza Mescla", "Cinza Claro",
  "Cinza Escuro", "Vermelho Escuro", "Preta", "Preto", "Branca", "Branco", "Vinho", "Bordô",
  "Vermelha", "Vermelho", "Marrom", "Cinza", "Grafite", "Chumbo", "Creme", "Bege", "Nude",
  "Areia", "Caramelo", "Mostarda", "Amarela", "Amarelo", "Laranja", "Roxa", "Roxo", "Lilás",
  "Rosa", "Pink", "Verde", "Azul", "Dourada", "Dourado", "Prateada", "Prateado", "Estampada",
  "Colorida", "Mescla",
];

function norm(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9&'/+-]+/g, " ")
    .trim();
}

/** Palavras do nome com a posição original (para recortar o texto). */
function tokens(text: string): string[] {
  return text.replace(/[–—]/g, " ").split(/\s+/).filter(Boolean);
}

/** Procura a sequência `phrase` em `words` (normalizado); devolve o índice. */
function findPhrase(words: string[], phrase: string, from = 0): number {
  const p = tokens(phrase).map(norm);
  const w = words.map(norm);
  for (let i = from; i + p.length <= w.length; i++) {
    if (p.every((x, k) => w[i + k] === x)) return i;
  }
  return -1;
}

const SIZE_SET = new Set(SIZE_SUGGESTIONS.map((s) => norm(s)).concat(["u", "unico", "xgg", "egg", "g1", "g2", "g3"]));

/** Palavras do "tipo" do produto, que não entram no modelo. */
const GENERIC = new Set(
  ["camiseta", "camisa", "masculina", "masculino", "feminina", "feminino", "premium", "texturizada",
   "basica", "básica", "tam", "tamanho", "de", "com", "e", "-", "+"].map(norm),
);

export function parseProductAttributes(
  name: string,
  extraBrands: string[] = [],
): ParsedAttributes {
  const words = tokens(name);
  const used = new Array(words.length).fill(false);
  const mark = (i: number, n: number) => {
    for (let k = i; k < i + n; k++) used[k] = true;
  };

  // Tamanho: último termo que é um tamanho (ignora "Tam").
  let size: string | null = null;
  for (let i = words.length - 1; i >= 0; i--) {
    const w = norm(words[i]);
    if (SIZE_SET.has(w)) {
      size = w === "unico" || w === "u" ? "Único" : words[i].toUpperCase();
      used[i] = true;
      if (i > 0 && norm(words[i - 1]) === "tam") used[i - 1] = true;
      break;
    }
  }

  // Marca: a primeira marca que aparece (as mais longas primeiro).
  let brand: string | null = null;
  let brandEnd = -1;
  const brands = [...new Set([...extraBrands.filter(Boolean), ...KNOWN_BRANDS])].sort(
    (a, b) => tokens(b).length - tokens(a).length,
  );
  let bestAt = Infinity;
  for (const b of brands) {
    const at = findPhrase(words, b);
    if (at >= 0 && at < bestAt) {
      bestAt = at;
      brand = b;
      brandEnd = at + tokens(b).length;
    }
  }
  if (brand) mark(bestAt, tokens(brand).length);

  // Cor: a última cor encontrada (depois da marca), compostas primeiro.
  let color: string | null = null;
  let colorAt = -1;
  for (const c of KNOWN_COLORS) {
    let at = -1;
    let from = Math.max(0, brandEnd);
    for (;;) {
      const f = findPhrase(words, c, from);
      if (f < 0) break;
      const free = tokens(c).every((_, k) => !used[f + k]);
      if (free) at = f;
      from = f + 1;
    }
    if (at > colorAt) {
      colorAt = at;
      color = c;
    }
  }
  if (color) mark(colorAt, tokens(color).length);

  // Modelo/estampa: o que sobra entre a marca e a cor (ou o tamanho).
  let model: string | null = null;
  if (brandEnd >= 0) {
    const stop = colorAt >= 0 ? colorAt : words.length;
    const rest = words
      .slice(brandEnd, stop)
      .filter((_, k) => !used[brandEnd + k])
      .filter((w, k, arr) => !(k === 0 && (w === "+" || w === "-")) && !(k === arr.length - 1 && (w === "+" || w === "-")));
    const text = rest.join(" ").replace(/\s+/g, " ").trim();
    if (text && !rest.every((w) => GENERIC.has(norm(w)))) model = text;
  }

  return { brand, model, color, size };
}
