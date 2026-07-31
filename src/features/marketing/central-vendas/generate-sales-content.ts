/**
 * Central de Vendas — Gerador de conteúdo por canal.
 *
 * Determinístico e 100% client-side. Usa apenas dados JÁ existentes
 * no cadastro do produto (nome, marca, categoria, descrição, preço,
 * tags, unidade). Não chama LLM, não cria banco, não duplica serviço.
 *
 * Toda tela da Central de Vendas abre COM conteúdo pronto. O usuário
 * apenas revisa e copia.
 */

import { formatCurrency } from "@/lib/format";

export type SalesChannel =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "mercado_livre"
  | "shopee"
  | "amazon"
  | "site";

export interface SalesChannelMeta {
  id: SalesChannel;
  label: string;
  emoji: string;
  hint: string;
}

export const SALES_CHANNELS: SalesChannelMeta[] = [
  { id: "instagram", label: "Instagram", emoji: "📸", hint: "Legenda, hashtags e CTA" },
  { id: "facebook", label: "Facebook", emoji: "👥", hint: "Post com CTA direto" },
  { id: "whatsapp", label: "WhatsApp", emoji: "💬", hint: "Mensagem pronta para enviar" },
  { id: "mercado_livre", label: "Mercado Livre", emoji: "🛒", hint: "Título, descrição e SEO" },
  { id: "shopee", label: "Shopee", emoji: "🧡", hint: "Título e palavras-chave" },
  { id: "amazon", label: "Amazon", emoji: "📦", hint: "Bullet points e keywords" },
  { id: "site", label: "Site próprio", emoji: "🌐", hint: "Descrição e SEO" },
];

/** Bloco de conteúdo exibido pela UI. */
export interface ContentBlock {
  label: string;
  value: string;
  /** Se true, renderiza em <textarea>; senão em <input>. */
  multiline?: boolean;
}

export interface GeneratedContent {
  channel: SalesChannel;
  blocks: ContentBlock[];
}

/** Entrada minima — apenas campos JÁ presentes no cadastro do produto. */
export interface ProductForSales {
  name: string;
  brand?: string | null;
  description?: string | null;
  price?: number | null;
  unit?: string | null;
  tags?: string[] | null;
  category?: { name?: string | null } | null;
  /** Caminho no storage da imagem principal (product_images.position = 0). */
  cover_image_path?: string | null;
}

/* ------------------------------- helpers -------------------------------- */

function clean(text?: string | null): string {
  return (text ?? "").trim();
}

function firstSentence(text?: string | null): string {
  const t = clean(text);
  if (!t) return "";
  const m = t.match(/^[^.!?\n]+[.!?]?/);
  return (m?.[0] ?? t).trim();
}

/** Slug simples de uma palavra para hashtag/keyword. */
function slug(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function keywordsFrom(product: ProductForSales, limit = 10): string[] {
  const raw = [
    product.name,
    product.brand ?? "",
    product.category?.name ?? "",
    ...(product.tags ?? []),
  ]
    .join(" ")
    .split(/\s+/)
    .map(slug)
    .filter((w) => w.length >= 3);
  return Array.from(new Set(raw)).slice(0, limit);
}

function hashtagsFrom(product: ProductForSales, limit = 8): string[] {
  return keywordsFrom(product, limit).map((k) => `#${k}`);
}

function priceLine(product: ProductForSales): string {
  const p = Number(product.price ?? 0);
  if (!p) return "";
  const unit = product.unit ? ` / ${product.unit}` : "";
  return `Por ${formatCurrency(p)}${unit}`;
}

function fallbackDescription(product: ProductForSales): string {
  const parts = [
    product.brand ? `Marca ${product.brand}.` : "",
    product.category?.name ? `Categoria: ${product.category.name}.` : "",
    "Qualidade garantida e entrega rápida.",
  ].filter(Boolean);
  return parts.join(" ");
}

function longDescription(product: ProductForSales): string {
  const desc = clean(product.description);
  if (desc.length >= 60) return desc;
  return `${desc ? desc + " " : ""}${fallbackDescription(product)}`.trim();
}

/* ---------------------------- geradores/canal --------------------------- */

function generateInstagram(p: ProductForSales): ContentBlock[] {
  const summary = firstSentence(p.description) || `${p.name} com qualidade ${p.brand ?? "premium"}.`;
  const priceStr = priceLine(p);
  const caption = [
    `✨ ${p.name}`,
    "",
    summary,
    priceStr ? `\n💰 ${priceStr}` : "",
    "\n👉 Chama no direct para garantir o seu!",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { label: "Resumo", value: summary },
    { label: "Legenda", value: caption, multiline: true },
    { label: "Hashtags", value: hashtagsFrom(p).join(" "), multiline: true },
    { label: "CTA", value: "Chama no direct e garanta o seu!" },
  ];
}

function generateFacebook(p: ProductForSales): ContentBlock[] {
  const summary = firstSentence(p.description) || fallbackDescription(p);
  const priceStr = priceLine(p);
  const post = [
    `${p.name}${p.brand ? ` — ${p.brand}` : ""}`,
    "",
    summary,
    priceStr ? `\n${priceStr}` : "",
    "\nEnvie uma mensagem e finalize sua compra hoje mesmo.",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { label: "Post", value: post, multiline: true },
    { label: "CTA", value: "Envie uma mensagem e garanta o seu" },
  ];
}

function generateWhatsapp(p: ProductForSales): ContentBlock[] {
  const summary = firstSentence(p.description) || fallbackDescription(p);
  const priceStr = priceLine(p);
  const msg = [
    `Olá! Tudo bem?`,
    "",
    `Temos disponível: *${p.name}*${p.brand ? ` (${p.brand})` : ""}.`,
    summary,
    priceStr ? `\n${priceStr}` : "",
    "\nPosso reservar o seu?",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { label: "Mensagem", value: msg, multiline: true },
    { label: "CTA", value: "Posso reservar o seu?" },
  ];
}

function generateMercadoLivre(p: ProductForSales): ContentBlock[] {
  const titleParts = [p.brand, p.name, p.category?.name].filter(Boolean) as string[];
  const title = titleParts.join(" ").slice(0, 60);
  const desc = longDescription(p);
  const features = [
    p.brand ? `Marca: ${p.brand}` : "",
    p.category?.name ? `Categoria: ${p.category.name}` : "",
    p.unit ? `Unidade: ${p.unit}` : "",
    ...(p.tags ?? []).map((t) => `Característica: ${t}`),
  ].filter(Boolean);
  return [
    { label: "Título (até 60 caracteres)", value: title },
    { label: "Descrição", value: desc, multiline: true },
    { label: "Características", value: features.join("\n"), multiline: true },
    { label: "SEO / termos de busca", value: keywordsFrom(p, 15).join(", "), multiline: true },
    { label: "Palavras-chave", value: keywordsFrom(p, 10).join(", ") },
  ];
}

function generateShopee(p: ProductForSales): ContentBlock[] {
  const titleParts = [p.brand, p.name].filter(Boolean) as string[];
  const title = titleParts.join(" ").slice(0, 100);
  return [
    { label: "Título (até 100 caracteres)", value: title },
    { label: "Descrição", value: longDescription(p), multiline: true },
    { label: "Palavras-chave", value: keywordsFrom(p, 10).join(", "), multiline: true },
  ];
}

function generateAmazon(p: ProductForSales): ContentBlock[] {
  const titleParts = [p.brand, p.name, p.category?.name].filter(Boolean) as string[];
  const title = titleParts.join(" - ").slice(0, 200);
  const bullets = [
    `Alta qualidade${p.brand ? ` da marca ${p.brand}` : ""}.`,
    p.category?.name ? `Ideal para ${p.category.name.toLowerCase()}.` : "Ideal para uso diário.",
    "Envio rápido e atendimento dedicado.",
    ...(p.tags ?? []).slice(0, 2).map((t) => `Destaque: ${t}.`),
  ].slice(0, 5);
  return [
    { label: "Título (até 200 caracteres)", value: title },
    { label: "Descrição", value: longDescription(p), multiline: true },
    { label: "Bullet points", value: bullets.map((b) => `• ${b}`).join("\n"), multiline: true },
    { label: "Keywords", value: keywordsFrom(p, 12).join(", "), multiline: true },
  ];
}

function generateSite(p: ProductForSales): ContentBlock[] {
  const summary = firstSentence(p.description) || fallbackDescription(p);
  const seoTitle = [p.name, p.brand].filter(Boolean).join(" | ").slice(0, 60);
  const seoDesc = summary.slice(0, 160);
  return [
    { label: "Resumo", value: summary, multiline: true },
    { label: "Descrição completa", value: longDescription(p), multiline: true },
    { label: "SEO title", value: seoTitle },
    { label: "SEO description", value: seoDesc, multiline: true },
    { label: "Slug", value: slug(p.name).replace(/^-+|-+$/g, "") },
  ];
}

const GENERATORS: Record<SalesChannel, (p: ProductForSales) => ContentBlock[]> = {
  instagram: generateInstagram,
  facebook: generateFacebook,
  whatsapp: generateWhatsapp,
  mercado_livre: generateMercadoLivre,
  shopee: generateShopee,
  amazon: generateAmazon,
  site: generateSite,
};

export function generateSalesContent(
  channel: SalesChannel,
  product: ProductForSales,
): GeneratedContent {
  return { channel, blocks: GENERATORS[channel](product) };
}
