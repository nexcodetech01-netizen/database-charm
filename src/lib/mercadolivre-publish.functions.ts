/**
 * Publica um produto do sistema como anúncio no Mercado Livre.
 *
 * Fluxo:
 *  1. Carrega o produto (RLS = usuário atual) e valida os campos obrigatórios.
 *  2. Garante um access_token válido (auto-refresh se necessário).
 *  3. Gera URLs assinadas públicas das imagens (o ML baixa e re-hospeda).
 *  4. POST em https://api.mercadolibre.com/items.
 *  5. Persiste ml_item_id / ml_permalink / ml_published_at no produto.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { integrationFetch } from "@/lib/http-client.server";
import { resolveCompanyId } from "@/lib/company-resolver.server";

export const mlAttributeSchema = z
  .object({
    id: z.string().regex(/^[A-Z0-9_]+$/, "id do atributo deve estar em CAIXA ALTA"),
    value_id: z.string().optional(),
    // value_name pode ser null quando o atributo usa `values[].struct` (ex.:
    // PACKAGE_LENGTH com número + unidade) ou quando o produto declara ausência
    // de código universal via EMPTY_GTIN_REASON.
    value_name: z
      .union([z.string().trim().min(1, "value_name obrigatório"), z.null()])
      .optional(),
    values: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();


export function filterMlFamilyNameAttribute<
  T extends { id?: unknown; key?: unknown },
>(attributes: readonly T[]): T[] {
  return attributes.filter((attribute) => {
    const id = typeof attribute.id === "string" ? attribute.id.trim().toLowerCase() : "";
    const key = typeof attribute.key === "string" ? attribute.key.trim().toLowerCase() : "";
    return id !== "family_name" && key !== "family_name";
  });
}

/**
 * Gera SKU determinístico com formato CAT-INICIAIS-#### quando o produto
 * não tem SKU cadastrado. Ex.: "Bolsa Fabíola Caramelo" + MLB457449 → BOL-FC-8421.
 */
export function buildAutoSku(name: string, _categoryId?: string | null): string {
  const words = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const catPrefix = (words[0] ?? "PRD").slice(0, 3).toUpperCase();
  const initials =
    words
      .slice(1, 4)
      .map((w) => w.slice(0, 3).toUpperCase())
      .join("-") || "GEN";
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${catPrefix}-${initials}-${suffix}`;
}



export const mlVariationSchema = z.object({
  price: z.number().positive(),
  available_quantity: z.number().int().nonnegative(),
  attribute_combinations: z
    .array(z.object({ id: z.string(), value_name: z.string().min(1) }))
    .min(1),
  picture_ids: z.array(z.string().min(1)).optional(),
});

export const mlPublishPayloadSchema = z
  .object({
    family_name: z.string().trim().min(1).max(50),
    category_id: z.string().regex(/^ML[A-Z]\d+$/),
    price: z.number().positive(),
    available_quantity: z.number().int().nonnegative(),
    currency_id: z.literal("BRL"),
    buying_mode: z.literal("buy_it_now"),
    condition: z.enum(["new", "used"]),
    listing_type_id: z.enum(["gold_special", "gold_pro"]),
    pictures: z.array(z.object({ source: z.string().url() })).min(1).max(12),
    description: z.string().optional(),
    seller_custom_field: z.string().trim().min(1).max(80).optional(),
    sale_terms: z.array(z.record(z.string(), z.unknown())).optional(),
    attributes: z.array(mlAttributeSchema).superRefine((attrs, ctx) => {
      const ids = new Set(attrs.map((a) => a.id));
      for (const required of ["BRAND", "MODEL"]) {
        if (!ids.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `attributes deve conter ${required}`,
          });
        }
      }
    }),
  })
  .strict();




// ─────────────────────────────────────────────────────────────────────────────
// Cache in-memory de metadados de categoria (tags como `selftitle`, settings).
// Categorias raramente mudam; TTL longo evita bater no ML a cada publicação.
// ─────────────────────────────────────────────────────────────────────────────

interface MlCategoryMeta {
  id: string;
  tags: string[];
}

const CATEGORY_META_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const categoryMetaCache = new Map<string, { meta: MlCategoryMeta; expiresAt: number }>();

export function __clearMlCategoryMetaCacheForTests() {
  categoryMetaCache.clear();
}

async function fetchMlCategoryMeta(categoryId: string): Promise<MlCategoryMeta> {
  const now = Date.now();
  const cached = categoryMetaCache.get(categoryId);
  if (cached && cached.expiresAt > now) return cached.meta;

  const res = await integrationFetch(
    `${ML_API}/categories/${encodeURIComponent(categoryId)}`,
    { headers: { Accept: "application/json" } },
    { integration: "mercadolivre:category", timeoutMs: 12_000 },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Não foi possível consultar a categoria ${categoryId} (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  let parsed: { id?: string; settings?: { tags?: unknown }; tags?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("O Mercado Livre retornou metadados de categoria inválidos.");
  }
  // A API expõe `settings.tags` (array de strings) na maioria das categorias;
  // algumas devolvem também `tags` na raiz. Unificamos ambos.
  const rawTags: unknown[] = [
    ...(Array.isArray(parsed.settings?.tags) ? (parsed.settings!.tags as unknown[]) : []),
    ...(Array.isArray(parsed.tags) ? (parsed.tags as unknown[]) : []),
  ];
  const tags = rawTags.filter((t): t is string => typeof t === "string");
  const meta: MlCategoryMeta = { id: categoryId, tags };
  categoryMetaCache.set(categoryId, { meta, expiresAt: now + CATEGORY_META_TTL_MS });
  return meta;
}

export function isSelfTitleCategory(meta: MlCategoryMeta): boolean {
  return meta.tags.includes("selftitle");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache in-memory de atributos de categoria (com suas listas fechadas de
// valores). Usado para resolver EMPTY_GTIN_REASON e outros atributos de lista
// fechada para o `value_id` aceito pela categoria, evitando erros do tipo
// "Attribute [X] is not valid, item values [null:texto livre]".
// ─────────────────────────────────────────────────────────────────────────────

export type MlCategoryAttribute = {
  id?: string;
  name?: string;
  value_type?: string;
  values?: Array<{ id?: string; name?: string }>;
  tags?: string[] | Record<string, boolean | string | number | null>;
};

const categoryAttributesCache = new Map<
  string,
  { attrs: MlCategoryAttribute[]; expiresAt: number }
>();

export function __clearMlCategoryAttributesCacheForTests() {
  categoryAttributesCache.clear();
}

async function fetchMlCategoryAttributes(
  categoryId: string,
  accessToken: string,
): Promise<MlCategoryAttribute[]> {
  const now = Date.now();
  const cached = categoryAttributesCache.get(categoryId);
  if (cached && cached.expiresAt > now) return cached.attrs;

  const res = await integrationFetch(
    `${ML_API}/categories/${encodeURIComponent(categoryId)}/attributes`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
    { integration: "mercadolivre:category-attributes", timeoutMs: 12_000 },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Não foi possível consultar os atributos da categoria (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("O Mercado Livre retornou uma lista de atributos inválida para a categoria.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("O Mercado Livre retornou uma lista de atributos inválida para a categoria.");
  }
  const attrs = parsed as MlCategoryAttribute[];
  categoryAttributesCache.set(categoryId, { attrs, expiresAt: now + CATEGORY_META_TTL_MS });
  return attrs;
}

/**
 * Resolve o valor de um atributo contra a lista fechada de valores aceitos
 * pela categoria. Retorna `{ value_id, value_name }` do valor casado, ou
 * `null` se o atributo não tem lista fechada (texto livre / numérico).
 *
 * Se `desired` não casar com nenhum valor, usa `fallbackKeywords` (para
 * atributos como EMPTY_GTIN_REASON, onde queremos algo genérico), e por
 * último cai no primeiro valor disponível.
 */
export function resolveClosedListValue(
  categoryAttr: MlCategoryAttribute | undefined,
  desired: string,
  fallbackKeywords: string[] = [],
): { value_id?: string; value_name: string } | null {
  if (!categoryAttr) return null;
  const values = (categoryAttr.values ?? []).filter(
    (v): v is { id?: string; name: string } => !!v.name?.trim(),
  );
  if (values.length === 0) return null;
  const vt = categoryAttr.value_type;
  // Atributos de texto livre / numéricos aceitam value_name arbitrário —
  // não são listas fechadas mesmo quando `values` traz sugestões.
  if (vt === "string" || vt === "number" || vt === "number_unit" || vt === "boolean") {
    return null;
  }
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const target = norm(desired);
  let match = values.find((v) => norm(v.name) === target);
  if (!match && fallbackKeywords.length > 0) {
    match = values.find((v) => fallbackKeywords.some((k) => norm(v.name).includes(norm(k))));
  }
  if (!match) match = values[0];
  return { value_id: match.id, value_name: match.name };
}





/**
 * Sanitiza títulos para publicação no Mercado Livre.
 * - Substitui travessões unicode por hífen simples.
 * - Remove emojis, aspas, símbolos e caracteres não-ASCII (mantém acentos PT-BR,
 *   dígitos, espaços, hífen e ponto).
 * - Normaliza espaços duplos e força o limite máximo de 60 caracteres.
 */
export function sanitizeMlTitle(rawTitle: string | null | undefined): string {
  return (rawTitle ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s\-.áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 60);
}



const ML_API = "https://api.mercadolibre.com";
const IMAGE_BUCKET = "product-images";

interface PublishInput {
  productId: string;
  categoryId: string;
  listingTypeId: "gold_special" | "gold_pro";
  condition: "new" | "used";
  title?: string;
  price?: number;
  availableQuantity?: number;
  description?: string;
  color?: string;
  brand?: string;
  model?: string;
  picturePaths?: string[];
  extraAttributes?: Array<{ id: string; value_name: string }>;
}

export const publishProductToMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PublishInput) => {
    const productId = String(input?.productId ?? "").trim();
    const categoryId = String(input?.categoryId ?? "").trim().toUpperCase();
    const listingTypeId = input?.listingTypeId;
    const condition = input?.condition;
    if (!productId) throw new Error("Produto obrigatório.");
    if (!categoryId || !/^ML[A-Z]\d+$/.test(categoryId)) {
      throw new Error("Categoria do Mercado Livre inválida (ex.: MLB1234).");
    }
    if (listingTypeId !== "gold_special" && listingTypeId !== "gold_pro") {
      throw new Error("Tipo de anúncio inválido.");
    }
    if (condition !== "new" && condition !== "used") {
      throw new Error("Condição inválida.");
    }
    const picturePaths = Array.isArray(input.picturePaths)
      ? input.picturePaths
          .map((p) => String(p ?? "").trim())
          .filter((p) => p.length > 0)
          .slice(0, 8)
      : undefined;
    const extraAttributes = Array.isArray(input.extraAttributes)
      ? input.extraAttributes
          .map((a) => ({
            id: String(a?.id ?? "").trim().toUpperCase(),
            value_name: String(a?.value_name ?? "").trim(),
          }))
          .filter((a) => /^[A-Z0-9_]+$/.test(a.id) && a.value_name.length > 0)
      : undefined;
    return {
      productId,
      categoryId,
      listingTypeId,
      condition,
      title: input.title?.toString().trim() || undefined,
      price: typeof input.price === "number" ? input.price : undefined,
      availableQuantity:
        typeof input.availableQuantity === "number" ? input.availableQuantity : undefined,
      description: input.description?.toString() || undefined,
      color: input.color?.toString().trim() || undefined,
      brand: input.brand?.toString().trim() || undefined,
      model: input.model?.toString().trim() || undefined,
      picturePaths,
      extraAttributes,
    };
  })


  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Empresa ativa — RC.0.2: exige vínculo real (owner / user_roles).
    const companyId = await resolveCompanyId(supabase, userId);
    if (!companyId) throw new Error("Nenhuma empresa ativa.");

    // 2. Produto
    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "id, company_id, name, description, price, stock, brand, sku, barcode, supplier_id, ml_item_id, ml_permalink",
      )
      .eq("id", data.productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) throw new Error("Produto não encontrado.");
    if ((product as { company_id: string }).company_id !== companyId) {
      throw new Error("Produto não pertence à empresa ativa.");
    }
    const existingMlItemId = (product as { ml_item_id: string | null }).ml_item_id;
    // Verificação de status é feita mais abaixo, após carregarmos o access_token,
    // para permitir republicar (POST /items) quando o anúncio anterior estiver
    // fechado, pausado ou sob moderação — nesses casos desvinculamos o
    // ml_item_id antigo do produto e seguimos criando um novo anúncio.

    const rawTitle = data.title ?? (product as { name: string }).name;
    // Sanitização estrita para o Mercado Livre (body.invalid_fields: [title]):
    // - travessões unicode -> hífen simples
    // - remove emojis, aspas, símbolos e caracteres não-ASCII (mantém acentos PT-BR, dígitos, espaço, - e .)
    // - normaliza espaços duplos e força limite de 60 caracteres
    const title = sanitizeMlTitle(rawTitle);
    const price = data.price ?? Number((product as { price: number }).price ?? 0);
    const availableQuantity =
      data.availableQuantity ?? Math.max(0, Math.floor(Number((product as { stock: number }).stock ?? 0)));
    const description = data.description ?? ((product as { description: string | null }).description ?? "");

    // BRAND dinâmica: prioriza override enviado no payload (edição no diálogo
    // de publicação); depois o valor cadastrado no produto; depois o nome do
    // fornecedor vinculado; por último o nome fantasia / razão social da
    // empresa ativa. Fallback final é "T&G" (marca oficial do vendedor) —
    // nunca "Genérica" / "Sem marca", que o Mercado Livre recusa com o erro
    // "A marca do produto não é genérica".
    const SELLER_DEFAULT_BRAND = "T&G";
    const GENERIC_BRAND_TOKENS = ["generica", "sem marca", "no brand", "generico"];
    const isGenericBrand = (value: string) => {
      const norm = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      return !norm || GENERIC_BRAND_TOKENS.some((token) => norm.includes(token));
    };
    const supplierId = (product as { supplier_id: string | null }).supplier_id;
    const [supplierRes, companyRes] = await Promise.all([
      supplierId
        ? supabase.from("product_suppliers").select("name").eq("id", supplierId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      supabase
        .from("companies")
        .select("name, trade_name")
        .eq("id", companyId)
        .maybeSingle(),
    ]);
    const supplierName = ((supplierRes.data as { name?: string | null } | null)?.name ?? "").trim();
    const companyRow = companyRes.data as { name?: string | null; trade_name?: string | null } | null;
    const companyBrand = (companyRow?.trade_name ?? companyRow?.name ?? "").trim();
    const productBrand = ((product as { brand: string | null }).brand ?? "").trim();
    const overrideBrand = (data.brand ?? "").trim();
    const brandCandidates = [overrideBrand, productBrand, supplierName, companyBrand].filter(
      (candidate) => candidate.length > 0 && !isGenericBrand(candidate),
    );
    const resolvedBrand = sanitizeMlTitle(
      brandCandidates[0] ?? SELLER_DEFAULT_BRAND,
    ).slice(0, 60);
    if (!resolvedBrand || resolvedBrand.length < 2) {
      throw new Error(
        "Marca inválida: preencha o campo 'Marca' do produto antes de publicar.",
      );
    }

    // Persiste no cadastro do produto a marca resolvida quando ele estiver
    // vazio ou marcado como genérico — evita repetir o mesmo ajuste manual em
    // futuras publicações do mesmo item.
    if (!productBrand || isGenericBrand(productBrand)) {
      await supabase
        .from("products")
        .update({ brand: resolvedBrand })
        .eq("id", data.productId);
    }


    if (!title || title.length < 3) throw new Error("Título muito curto (mínimo 3 caracteres após sanitização).");
    if (!(price > 0)) throw new Error("Preço deve ser maior que zero.");
    if (!(availableQuantity > 0)) throw new Error("Estoque disponível deve ser maior que zero.");


    // 3. Garante access_token válido e recupera do banco
    const { ensureFreshAccessToken } = await import("./mercadolivre.server");
    await ensureFreshAccessToken(supabase, companyId, userId);

    const { data: integration, error: integrationError } = await supabase
      .from("mercadolivre_integrations")
      .select("access_token_encrypted, token_expires_at")
      .eq("company_id", companyId)
      .maybeSingle();
    if (integrationError) throw integrationError;
    const accessEncrypted = (integration as { access_token_encrypted: string | null } | null)
      ?.access_token_encrypted;
    if (!accessEncrypted) {
      throw new Error("Mercado Livre não está conectado. Autorize a integração em Configurações.");
    }
    const { decryptToken } = await import("./meta-crypto.server");
    const accessToken = decryptToken(accessEncrypted);

    // Se existe um ml_item_id vinculado, checa o status atual no Mercado Livre.
    // Só bloqueia quando o anúncio está ATIVO. Para status como closed, paused,
    // under_review ou inactive, desvincula o ml_item_id do produto e prossegue
    // com um POST /items (criação de novo anúncio).
    if (existingMlItemId) {
      try {
        const statusRes = await integrationFetch(
          `https://api.mercadolibre.com/items/${existingMlItemId}?attributes=status`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          { integration: "mercadolivre:item-status-check", timeoutMs: 12_000 },
        );
        if (statusRes.ok) {
          const statusJson = (await statusRes.json()) as { status?: string };
          const status = (statusJson.status ?? "").toLowerCase();
          if (status === "active") {
            throw new Error("Este produto já possui um anúncio ativo no Mercado Livre.");
          }
          // closed / paused / under_review / inactive / not_yet_active → desvincula
          await supabase
            .from("products")
            .update({ ml_item_id: null, ml_permalink: null })
            .eq("id", data.productId);
        } else if (statusRes.status === 404) {
          // Item removido da base do ML — apenas desvincula.
          await supabase
            .from("products")
            .update({ ml_item_id: null, ml_permalink: null })
            .eq("id", data.productId);
        } else {
          const txt = await statusRes.text().catch(() => "");
          console.warn("[mercadolivre] status check falhou:", statusRes.status, txt);
          // Em caso de falha inesperada, desvincula para permitir republicação.
          await supabase
            .from("products")
            .update({ ml_item_id: null, ml_permalink: null })
            .eq("id", data.productId);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("já possui um anúncio ativo")) {
          throw err;
        }
        console.warn("[mercadolivre] erro ao checar status do item:", err);
        await supabase
          .from("products")
          .update({ ml_item_id: null, ml_permalink: null })
          .eq("id", data.productId);
      }
    }

    // 4. Imagens: URLs assinadas de longa duração (ML re-hospeda no primeiro fetch)
    const { data: images, error: imagesError } = await supabase
      .from("product_images")
      .select("path, position")
      .eq("product_id", data.productId)
      .order("position", { ascending: true });
    if (imagesError) throw imagesError;
    const allPaths = (images ?? [])
      .map((r) => (r as { path: string | null }).path)
      .filter((p): p is string => !!p);
    // Se o usuário informou `picturePaths` (seleção manual, até 5), respeita a
    // ordem escolhida e valida que cada caminho pertence de fato ao produto.
    const selected = data.picturePaths?.filter((p) => allPaths.includes(p)) ?? [];
    // Score do ML sobe com 3-8 fotos boas; enviamos até 8 quando o produto
    // tiver mais imagens cadastradas no Storage.
    const imagePaths = (selected.length > 0 ? selected : allPaths).slice(0, 8);

    const pictures: { source: string }[] = [];
    for (const path of imagePaths) {
      const { data: signed, error: sErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
      if (!sErr && signed?.signedUrl) pictures.push({ source: signed.signedUrl });
    }

    if (pictures.length === 0) {
      throw new Error("O produto precisa ter ao menos uma foto para ser anunciado.");
    }

    // 5. Payload como ITEM SIMPLES para categoria MLB457449 (Bolsas):
    //    - `family_name` na raiz (até 50 chars), sem `title`
    //    - `price` e `available_quantity` OBRIGATORIAMENTE na raiz
    //    - attributes: BRAND (Genérica), MODEL, COLOR + ficha técnica estendida
    //      (GENDER, MATERIAL, BAG_TYPE etc.) fornecida pelo usuário.
    const cleanTitle = title.replace(/\s+/g, " ").trim().slice(0, 60);
    const listingTypeId = data.listingTypeId;
    const overrideModel = (data.model ?? "").trim();
    const model = (overrideModel || cleanTitle).slice(0, 60);
    const color = (data.color ?? "").trim();
    const quantity = availableQuantity;

    // Merge de atributos: base obrigatória (BRAND/MODEL/COLOR/GENDER/
    // MAIN_MATERIAL/PATTERN_NAME) + extras da ficha técnica. Extras com o mesmo
    // id sobrescrevem o default, garantindo que gênero/material/padrão
    // informados pelo usuário prevaleçam. Normaliza aliases legados
    // (MATERIAL -> MAIN_MATERIAL) para bater com os IDs oficiais da categoria
    // de bolsas (MLB457449).
    const ATTR_ALIASES: Record<string, string> = { MATERIAL: "MAIN_MATERIAL" };
    const normalizedExtras = new Map<string, string>();
    for (const extra of data.extraAttributes ?? []) {
      const id = ATTR_ALIASES[extra.id] ?? extra.id;
      const value = (extra.value_name ?? "").trim();
      if (!value) continue;
      normalizedExtras.set(id, value);
    }

    const pick = (id: string, fallback: string) =>
      normalizedExtras.get(id)?.trim() || fallback;

    // Pega SKU e GTIN direto do cadastro. Se o SKU estiver vazio, gera um
    // fallback determinístico (CAT-NOME-#) e persiste no produto para manter
    // rastreabilidade entre plataformas.
    const productBarcode = ((product as { barcode: string | null }).barcode ?? "").trim();
    let productSku = ((product as { sku: string | null }).sku ?? "").trim();
    if (!productSku) {
      productSku = buildAutoSku((product as { name: string }).name, data.categoryId);
      await supabase.from("products").update({ sku: productSku }).eq("id", data.productId);
    }


    type MlAttr = {
      id: string;
      value_id?: string;
      value_name?: string | null;
      values?: Array<Record<string, unknown>>;
    };

    const baseAttrs: MlAttr[] = [
      { id: "BRAND", value_name: SELLER_DEFAULT_BRAND },
      { id: "MODEL", value_name: pick("MODEL", model || SELLER_DEFAULT_BRAND) },
      { id: "COLOR", value_name: pick("COLOR", color || "Caramelo") },
      { id: "GENDER", value_name: pick("GENDER", "Feminino") },
      { id: "MAIN_MATERIAL", value_name: pick("MAIN_MATERIAL", "Sintético") },
      { id: "PATTERN_NAME", value_name: pick("PATTERN_NAME", "Liso") },
      { id: "WITH_ZIPPER", value_name: pick("WITH_ZIPPER", "Sim") },
      { id: "AGE_GROUP", value_name: pick("AGE_GROUP", "Adultos") },
      { id: "SEASON", value_name: pick("SEASON", "Permanente") },
      // Tipo de bolsa — atributo relevante para busca/filtros e score de ficha.
      { id: "BAG_TYPE", value_name: pick("BAG_TYPE", "Transversal") },
      // SKU do vendedor — reforço de rastreabilidade além de seller_custom_field.
      { id: "SELLER_SKU", value_name: pick("SELLER_SKU", productSku || "SKU") },
      // Dimensões padrão de embalagem para bolsas (30x20x10 cm / 500 g) — evita
      // penalização de qualidade quando o vendedor não preencheu manualmente.
      { id: "PACKAGE_LENGTH", value_name: pick("PACKAGE_LENGTH", "30 cm") },
      { id: "PACKAGE_WIDTH", value_name: pick("PACKAGE_WIDTH", "20 cm") },
      { id: "PACKAGE_HEIGHT", value_name: pick("PACKAGE_HEIGHT", "10 cm") },
      { id: "PACKAGE_WEIGHT", value_name: pick("PACKAGE_WEIGHT", "500 g") },
    ];
    // GTIN: envia o EAN apenas quando cadastrado e válido. Caso contrário,
    // NÃO envia nada — nem GTIN, nem EMPTY_GTIN_REASON. O ML tem rejeitado
    // EMPTY_GTIN_REASON como "attribute is not valid" em várias categorias,
    // então a estratégia segura é omitir ambos quando o produto não possui
    // código de barras cadastrado.
    const rawBarcode = (productBarcode ?? "").trim();
    const isNotApplicable = /^(n[aã]o\s*aplic[aá]vel|n\/?a)$/i.test(rawBarcode);
    if (rawBarcode && !isNotApplicable) {
      baseAttrs.push({ id: "GTIN", value_name: rawBarcode });
    }



    const seenIds = new Set(baseAttrs.map((a) => a.id));
    for (const [id, value_name] of normalizedExtras) {
      if (seenIds.has(id)) continue;
      baseAttrs.push({ id, value_name });
      seenIds.add(id);
    }

    const body: Record<string, unknown> = {
      family_name: cleanTitle.substring(0, 50),
      category_id: "MLB457449",
      price: Number(price),
      available_quantity: Number(quantity),
      currency_id: "BRL",
      buying_mode: "buy_it_now",
      listing_type_id: listingTypeId || "gold_special",
      condition: "new",
      pictures: pictures,
      description: description,
      attributes: baseAttrs,
    };
    if (productSku) body.seller_custom_field = productSku;

    // Parcelamento sem juros: no Premium (gold_pro) o ML aceita configurar
    // parcelas sem acréscimo via sale_terms, o que sobe o score do anúncio e
    // exibe o selo "sem juros" na vitrine. Calculamos até 12x mantendo o valor
    // mínimo por parcela em R$ 5 (regra padrão do ML).
    const effectiveListingType = listingTypeId || "gold_special";
    if (effectiveListingType === "gold_pro") {
      const maxInstallments = Math.max(
        1,
        Math.min(12, Math.floor(Number(price) / 5)),
      );
      if (maxInstallments >= 2) {
        const installmentAmount = Number(
          (Number(price) / maxInstallments).toFixed(2),
        );
        body.sale_terms = [
          {
            id: "INSTALLMENTS",
            value_struct: {
              number: maxInstallments,
              amount: installmentAmount,
              rate: 0,
            },
            value_name: `${maxInstallments}x de ${installmentAmount} sem juros`,
          },
        ];
      }
    }



    // Defesa final antes do POST:
    // 1) o ML rejeita family_name dentro de attributes;
    // 2) atributos com value_name/value_id null/undefined/vazio disparam
    //    "invalid item attribute values" — remover;
    // 3) GTIN e EMPTY_GTIN_REASON só podem existir com valor válido;
    //    quando o EAN não está cadastrado, ambos devem ser removidos.
    const sanitizedAttrs = filterMlFamilyNameAttribute(baseAttrs).filter((a) => {
      if (a.id === "GTIN" || a.id === "EMPTY_GTIN_REASON") {
        const v = typeof a.value_name === "string" ? a.value_name.trim() : "";
        const vid = typeof a.value_id === "string" ? a.value_id.trim() : "";
        if (!v && !vid) return false;
        if (a.id === "GTIN" && /^(n[aã]o\s*aplic[aá]vel|n\/?a)$/i.test(v)) {
          return false;
        }
      }
      const hasStruct = Array.isArray(a.values) && a.values.length > 0;
      if (hasStruct) return true;
      const hasValueId = typeof a.value_id === "string" && a.value_id.trim().length > 0;
      const hasValueName = typeof a.value_name === "string" && a.value_name.trim().length > 0;
      return hasValueId || hasValueName;
    });

    const requestBody = {
      ...body,
      attributes: sanitizedAttrs,
    };


    const validation = mlPublishPayloadSchema.safeParse(requestBody);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      console.error("ML Publish Payload inválido:", issues, JSON.stringify(requestBody, null, 2));
      throw new Error(`Payload do Mercado Livre inválido: ${issues}`);
    }

    console.log("PAYLOAD_ENVIADO_ML:", JSON.stringify(requestBody, null, 2));

    const postItem = (requestBody: Record<string, unknown>) =>
      fetch(`${ML_API}/items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });



    const itemRes = await postItem(requestBody);
    const itemText = await itemRes.text();


    if (!itemRes.ok) {
      // Extrai o array `cause` do ML para diagnóstico preciso no toast do frontend.
      let causeDetails = "";
      let parsedErr: { message?: string; error?: string; cause?: unknown } = {};
      try {
        parsedErr = JSON.parse(itemText) as typeof parsedErr;
        if (parsedErr.cause) {
          causeDetails = ` | cause=${JSON.stringify(parsedErr.cause)}`;
        } else if (parsedErr.message) {
          causeDetails = ` | ${parsedErr.message}`;
        }
      } catch {
        // resposta não-JSON — mantém o texto bruto abaixo.
      }
      console.error("[mercadolivre] POST /items falhou:", itemRes.status, itemText);

      // 403 seller.unable_to_list → conta com pendências (cadastro/fiscal/termos).
      const rawBlob = `${parsedErr.error ?? ""} ${parsedErr.message ?? ""} ${itemText}`.toLowerCase();
      if (itemRes.status === 403 || rawBlob.includes("unable_to_list")) {
        throw new Error(
          "Sua conta do Mercado Livre não está autorizada a publicar anúncios no momento. Verifique se há pendências de cadastro, validação fiscal ou aceite de termos diretamente no painel do Mercado Livre.",
        );
      }

      throw new Error(
        `Falha ao publicar no Mercado Livre (${itemRes.status}): ${itemText.slice(0, 400)}${causeDetails} | PAYLOAD_ENVIADO=${JSON.stringify(body)}`,
      );
    }

    const item = JSON.parse(itemText) as {

      id: string;
      permalink?: string | null;
    };


    // 6. Descrição em texto puro (endpoint separado). Falha silenciosa não deve
    //    invalidar a publicação — o anúncio já existe.
    if (description && description.trim()) {
      try {
        await integrationFetch(
          `${ML_API}/items/${item.id}/description`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ plain_text: description.slice(0, 50000) }),
          },
          { integration: "mercadolivre:item-description", timeoutMs: 20_000 },
        );
      } catch (err) {
        console.warn("[mercadolivre] descrição não pôde ser gravada", err);
      }
    }

    // 7. Persiste vínculo
    const { error: updError } = await supabase
      .from("products")
      .update({
        ml_item_id: item.id,
        ml_status: (item as any).status || "active",
        ml_permalink: item.permalink ?? null,
        ml_published_at: new Date().toISOString(),
      } as any)
      .eq("id", data.productId);
    if (updError) throw updError;

    return {
      ok: true as const,
      mlItemId: item.id,
      permalink: item.permalink ?? null,
    };
  });

/** Prediz a categoria do Mercado Livre a partir do título (sem autenticação). */
export const predictMercadoLivreCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; siteId?: string }) => {
    const title = String(input?.title ?? "").trim();
    if (!title) throw new Error("Informe um título para prever a categoria.");
    const siteId = (input?.siteId ?? "MLB").toString().toUpperCase();
    return { title, siteId };
  })
  .handler(async ({ data }) => {
    const url =
      `${ML_API}/sites/${data.siteId}/domain_discovery/search?limit=5&q=` +
      encodeURIComponent(data.title);
    const res = await integrationFetch(
      url,
      { headers: { Accept: "application/json" } },
      { integration: "mercadolivre:category-predict", timeoutMs: 12_000 },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Falha na predição de categoria (${res.status}): ${text.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text) as Array<{
      category_id?: string;
      category_name?: string;
      domain_id?: string;
      domain_name?: string;
    }>;
    return parsed
      .filter((p) => p.category_id)
      .map((p) => ({
        categoryId: p.category_id as string,
        categoryName: p.category_name ?? p.category_id ?? "",
        domainName: p.domain_name ?? null,
      }));
  });
