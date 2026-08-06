/**
 * Gera descrição + Ficha Técnica (atributos) prontos para publicação no
 * Mercado Livre a partir dos dados do produto. Retorna JSON estruturado
 * com `description` e `attributes` (product_type, gender, bag_type,
 * material, style, color).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

interface Input {
  title: string;
  price?: number;
  categoryLabel?: string;
  categoryId?: string;
  brand?: string;
  productName?: string;
  productDetails?: string;
}

const AttributesSchema = z.object({
  product_type: z.string(),
  gender: z.string(),
  bag_type: z.string(),
  material: z.string(),
  style: z.string(),
  color: z.string(),
  pattern: z.string().optional().default(""),
  with_zipper: z.string().optional().default(""),
  age_group: z.string().optional().default(""),
  season: z.string().optional().default(""),
});

const OutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  attributes: AttributesSchema,
});

export type MlAiAttributes = z.infer<typeof AttributesSchema>;

export const generateMercadoLivreDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    const title = String(input?.title ?? "").trim();
    if (!title) throw new Error("Título é obrigatório para gerar a descrição.");
    return {
      title: title.slice(0, 120),
      price: typeof input.price === "number" && input.price > 0 ? input.price : undefined,
      categoryLabel: input.categoryLabel?.toString().trim() || undefined,
      categoryId: input.categoryId?.toString().trim() || undefined,
      brand: input.brand?.toString().trim() || undefined,
      productName: input.productName?.toString().trim() || undefined,
      productDetails: input.productDetails?.toString().slice(0, 4000) || undefined,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const priceLine =
      data.price !== undefined
        ? `Preço de venda: R$ ${data.price.toFixed(2).replace(".", ",")}`
        : "Preço: (informar preço competitivo pelo vendedor)";
    const categoryLine = data.categoryLabel
      ? `Categoria Mercado Livre: ${data.categoryLabel}${data.categoryId ? ` (${data.categoryId})` : ""}`
      : "";
    const brandLine = data.brand ? `Marca: ${data.brand}` : "";
    const detailsLine = data.productDetails
      ? `Detalhes cadastrados do produto:\n${data.productDetails}`
      : "Detalhes cadastrados: não informados. Use inferências razoáveis sem inventar especificações técnicas.";

    const system = [
      "Você é um copywriter especialista em anúncios do Mercado Livre Brasil, focado em bolsas e moda.",
      "Sua tarefa é DEVOLVER UM JSON com três campos: `title`, `description` e `attributes`.",
      "",
      "REGRAS PARA `title` (Título otimizado do anúncio, pt-BR):",
      "- Estrutura obrigatória, nesta ordem: [Tipo de Produto] + [Gênero] + [Estilo/Tipo de alça] + [Modelo] + [Cor].",
      "- Tamanho: mínimo 35 caracteres, ideal entre 45 e 55, máximo ABSOLUTO 60.",
      "- Sem emojis, sem aspas, sem #, sem **, sem pontuação decorativa. Use hífen simples se precisar.",
      "- Cada palavra com Primeira Letra Maiúscula (exceto conectivos curtos como 'de', 'em', 'e').",
      "- NÃO invente marca. NÃO repita palavras. NÃO use 'N/A'.",
      "- PROIBIDO (política do Mercado Livre) — NUNCA use no título: 'Original', '100% Original', 'Autêntico', 'Promoção', 'Oferta', 'Liquidação', 'Barato', 'Frete Grátis', 'Entrega Rápida', 'Novo', 'Lançamento', 'Qualidade', 'Top', 'Melhor', 'Excelente'.",
      "- Se a marca for genérica ('Genérica', 'Outras marcas', 'Sem marca'), foque APENAS em atributos físicos (tipo, gênero, estilo, modelo, cor, material). Nunca use 'Original'.",
      "- Se faltar informação para atingir o mínimo, complete com atributos físicos reais (material, estilo, tipo de alça) — nunca com termos promocionais.",
      "- Exemplo correto: 'Bolsa Feminina Transversal Baguete Fabíola Caramelo'.",
      "",
      "REGRAS PARA `description` (texto puro em pt-BR):",
      "- Máximo ABSOLUTO de 60 palavras.",
      "- Sem HTML, sem Markdown, sem #, sem **, sem emojis.",
      "- Estrutura exata (respeitando quebras de linha):",
      "  <título>",
      "  <1 frase resumida, máx 2 linhas>",
      "  Características:",
      "  * Cor: <cor>",
      "  * Modelo: <modelo>",
      "  * <3 a 4 bullets curtos adicionais>",
      "  Ideal para <3-4 ocasiões separadas por vírgula>.",
      "  Envio rápido e produto bem embalado.",
      "- Use marcador '* ' nos bullets. Sem saudações/despedidas/frases genéricas.",
      "- Não repita o título literalmente na frase resumo. Não invente medidas/garantias.",
      "",
      "REGRAS PARA `attributes` (Ficha Técnica) — sempre em pt-BR e Primeira Letra Maiúscula:",
      "- product_type: tipo do produto (ex.: 'Bolsa', 'Mochila', 'Carteira').",
      "- gender: 'Feminino', 'Masculino' ou 'Sem gênero'.",
      "- bag_type: subtipo específico do modelo. Analise cuidadosamente o título, nome e detalhes do produto para identificar o formato correto. Valores aceitos (use EXATAMENTE um destes quando aplicável):",
      "    * 'Baguete' — bolsa alongada, estreita e horizontal, alça curta (se o nome/descrição mencionar 'baguete', use este valor).",
      "    * 'Tote' — bolsa estruturada grande com duas alças de mão.",
      "    * 'Sacola' — formato de sacola aberta, geralmente sem estrutura rígida.",
      "    * 'Transversal' — usada cruzada no corpo com alça longa.",
      "    * 'Tiracolo' — alça longa apoiada em um ombro.",
      "    * 'Clutch' — bolsa de mão pequena, sem alça ou com alça fina, para festas.",
      "    * 'Mochila' — duas alças para as costas.",
      "    * 'Baú' — formato arredondado/estruturado tipo baú.",
      "    * 'Shoulder Bag' — bolsa de ombro clássica.",
      "    * 'Hobo' — formato de meia-lua, macia, alça única no ombro.",
      "  Se o nome do produto contiver termos como 'baguete', 'tote', 'clutch', 'mochila' etc., use esse termo como valor principal. Só use termo genérico se realmente não houver indicação do modelo.",
      "- material: material principal (ex.: 'Sintético', 'Couro', 'Lona', 'Nylon').",
      "- style: estilo (ex.: 'Casual', 'Elegante', 'Esportivo', 'Festa').",
      "- color: cor(es) principais (ex.: 'Preto', 'Off White/Marrom').",
      "- pattern: padrão de tecido/estampa. Padrão sugerido 'Liso'. Só use outro (ex.: 'Estampado', 'Xadrez', 'Animal Print', 'Floral') se o produto claramente indicar.",
      "- with_zipper: 'Sim' ou 'Não'. Padrão 'Sim' salvo indicação clara em contrário.",
      "- age_group: faixa etária. Padrão 'Adultos' (também aceito: 'Juvenil', 'Infantil').",
      "- season: estação. Padrão 'Permanente' (também aceito: 'Verão', 'Inverno', 'Primavera', 'Outono').",
      "- Se realmente não houver base para inferir, retorne string vazia — nunca 'N/A'.",
    ].join("\n");

    const prompt = [
      "Dados do produto:",
      `Título do anúncio: ${data.title}`,
      data.productName && data.productName !== data.title ? `Nome interno: ${data.productName}` : "",
      brandLine,
      priceLine,
      categoryLine,
      detailsLine,
      "",
      "Retorne SOMENTE o JSON com `title`, `description` e `attributes` preenchidos.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { output } = await generateText({
        model,
        system,
        prompt,
        temperature: 0.5,
        output: Output.object({ schema: OutputSchema }),
      });

      const cleanedDescription = (output.description ?? "")
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/i, "")
        .replace(/\*\*/g, "")
        .replace(/^#+\s*/gm, "")
        .trim();

      if (!cleanedDescription) throw new Error("A IA retornou uma descrição vazia.");

      return {
        title: normalizeTitle(output.title, data.title),
        description: cleanedDescription.slice(0, 4000),
        attributes: normalizeAttributes(output.attributes),
      };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const fallback = tryParseJson(err.text ?? "");
        if (fallback?.description) {
          return {
            title: normalizeTitle(fallback.title, data.title),
            description: String(fallback.description).slice(0, 4000),
            attributes: normalizeAttributes(fallback.attributes ?? {}),
          };
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        throw new Error("Limite de requisições da IA atingido. Tente novamente em instantes.");
      }
      if (msg.includes("402")) {
        throw new Error("Créditos de IA esgotados. Adicione créditos nas configurações do workspace.");
      }
      throw new Error(`Falha ao gerar descrição: ${msg}`);
    }
  });

function normalizeAttributes(raw: unknown): MlAiAttributes {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const clean = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s || /^n\/?a$/i.test(s)) return "";
    return s;
  };
  return {
    product_type: clean(obj.product_type),
    gender: clean(obj.gender),
    bag_type: clean(obj.bag_type),
    material: clean(obj.material),
    style: clean(obj.style),
    color: clean(obj.color),
    pattern: clean(obj.pattern) || "Liso",
    with_zipper: clean(obj.with_zipper) || "Sim",
    age_group: clean(obj.age_group) || "Adultos",
    season: clean(obj.season) || "Permanente",
  };
}

const TITLE_CONNECTORS = new Set(["de", "da", "do", "e", "em", "com", "para", "com", "para"]);

// Termos proibidos pelo Mercado Livre em títulos (política oficial).
const TITLE_BLACKLIST = [
  "original", "originais", "autentico", "autêntico", "autentica", "autêntica",
  "promocao", "promoção", "oferta", "ofertas", "liquidacao", "liquidação",
  "barato", "barata", "baratos", "baratas",
  "frete", "gratis", "grátis",
  "novo", "nova", "novos", "novas", "lancamento", "lançamento",
  "qualidade", "top", "melhor", "melhores", "excelente", "excelentes",
  "imperdivel", "imperdível", "presente", "brinde", "bonus", "bônus",
  "envio", "imediato", "hoje", "agora",
];

function stripBlacklistedTerms(text: string): string {
  return text
    .split(" ")
    .filter((w) => {
      const norm = w
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return !TITLE_BLACKLIST.some((bad) => {
        const badNorm = bad.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return norm === badNorm;
      });
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(raw: unknown, fallback: string): string {
  const source = typeof raw === "string" && raw.trim() ? raw : fallback;
  const cleaned = String(source)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/["'`“”‘’]/g, "")
    .replace(/[#*_<>@]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const sanitized = stripBlacklistedTerms(cleaned);
  const base = sanitized || cleaned;
  const cased = base
    .split(" ")
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && TITLE_CONNECTORS.has(lower)) return lower;
      if (w.length <= 2) return w;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
  return cased.length > 60 ? cased.slice(0, 60).trimEnd() : cased;
}


function tryParseJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const v = JSON.parse(trimmed);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
