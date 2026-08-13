import { supabase } from "@/integrations/supabase/client";
/**
 * Gerador automático de SKU no padrão CATEGORIA-MODELO-COR-SEQUENCIAL.
 *
 * Ex.: "Bolsa Milano Preta" (categoria Bolsa) → BOL-MIL-PRE-001
 *
 * A cor é derivada da última palavra do nome do produto — segue os exemplos
 * fornecidos pelo produto (nome inclui a cor).
 */
const CATEGORY_PREFIXES = {
    bolsa: "BOL",
    bolsas: "BOL",
    carteira: "CAR",
    carteiras: "CAR",
    mochila: "MOC",
    mochilas: "MOC",
    acessorio: "ACS",
    acessorios: "ACS",
};
/**
 * Palavras genéricas ignoradas ao escolher o "modelo" no nome do produto.
 * Evita SKUs redundantes como BOL-BOL-... quando o nome começa por "Bolsa".
 */
const GENERIC_MODEL_WORDS = new Set([
    "bolsa", "bolsas",
    "carteira", "carteiras",
    "mochila", "mochilas",
    "mala", "malas",
    "necessaire", "necessaires",
    "acessorio", "acessorios",
    "clutch", "clutches",
    "pasta", "pastas",
    "pochete", "pochetes",
    "nova", "novo",
    "kit",
]);
/**
 * Palavras conectivas ignoradas (preposições, artigos, hífens soltos, etc.).
 */
const SKIP_CONNECTORS = new Set([
    "de", "da", "do", "das", "dos", "e", "com", "para", "por", "a", "o", "as", "os", "-", "–",
]);
function stripAccents(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalizeKey(s) {
    return stripAccents(s.trim().toLowerCase());
}
function first3(s) {
    return stripAccents(s).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}
function prefixFor(word) {
    return CATEGORY_PREFIXES[normalizeKey(word)] ?? first3(word);
}
/**
 * Retorna o índice da primeira palavra "relevante" para virar o modelo,
 * ignorando categorias genéricas, conectores e tokens não-alfanuméricos.
 */
function findModelIndex(words, start, categoryName) {
    const categoryKey = categoryName ? normalizeKey(categoryName) : null;
    for (let i = start; i < words.length; i++) {
        const key = normalizeKey(words[i]);
        if (!key)
            continue;
        if (SKIP_CONNECTORS.has(key))
            continue;
        if (GENERIC_MODEL_WORDS.has(key))
            continue;
        if (categoryKey && key === categoryKey)
            continue;
        if (!/[a-z0-9]/.test(key))
            continue;
        return i;
    }
    return -1;
}
/**
 * Monta a base "CAT-MOD-COR" a partir do nome + categoria.
 * Retorna null quando o nome está vazio.
 */
export function buildSkuBase(name, categoryName) {
    const cleanName = name.trim();
    if (!cleanName)
        return null;
    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return null;
    let categoryPrefix = "";
    let modelStart = 0;
    if (categoryName && categoryName.trim()) {
        categoryPrefix = prefixFor(categoryName);
    }
    else {
        // Sem categoria: infere pelo primeiro token do nome e avança.
        categoryPrefix = prefixFor(words[0]);
        modelStart = 1;
    }
    const modelIdx = findModelIndex(words, modelStart, categoryName);
    if (modelIdx === -1) {
        // Nenhuma palavra relevante encontrada — usa fallback do próprio nome.
        const fallback = words.find((w) => /[a-z0-9]/i.test(w));
        if (!fallback)
            return categoryPrefix || null;
        return [categoryPrefix, first3(fallback)].filter(Boolean).join("-");
    }
    const model = first3(words[modelIdx]);
    // Cor = última palavra alfanumérica, desde que não seja a mesma do modelo.
    let colorIdx = -1;
    for (let i = words.length - 1; i > modelIdx; i--) {
        const key = normalizeKey(words[i]);
        if (!key || SKIP_CONNECTORS.has(key) || !/[a-z0-9]/.test(key))
            continue;
        colorIdx = i;
        break;
    }
    if (colorIdx === -1) {
        return [categoryPrefix, model].filter(Boolean).join("-");
    }
    const color = first3(words[colorIdx]);
    return [categoryPrefix, model, color].filter(Boolean).join("-");
}
/**
 * Gera o próximo SKU disponível consultando os SKUs existentes na empresa
 * que compartilham a mesma base.
 */
/**
 * Fonte única de verdade: delega para `public.generate_product_sku` no Postgres,
 * que é a mesma função usada pelo fluxo SQL de recebimento de compras
 * (`receive_purchase` / `reprocess_received_purchase`). Assim garantimos que
 * formulário e automações produzam SKUs com o mesmo padrão.
 *
 * O `buildSkuBase` local permanece exportado para pré-visualização no formulário
 * (evita ida ao servidor a cada tecla), mas o SKU efetivamente gravado sempre
 * vem da RPC.
 */
export async function generateNextSku(companyId, name, categoryName) {
    const trimmed = name?.trim();
    if (!trimmed)
        return null;
    const { data, error } = await supabase.rpc("generate_product_sku", {
        _company_id: companyId,
        _name: trimmed,
        _category_name: categoryName ?? undefined,
    });
    if (error || !data)
        return null;
    return data;
}
/**
 * Verifica se um SKU já está em uso por outro produto da mesma empresa.
 * Se `ignoreProductId` for informado, o próprio produto é ignorado (edição).
 */
export async function isSkuTaken(companyId, sku, ignoreProductId) {
    const trimmed = sku.trim();
    if (!trimmed)
        return false;
    let query = supabase
        .from("products")
        .select("id")
        .eq("company_id", companyId)
        .ilike("sku", trimmed)
        .limit(1);
    if (ignoreProductId)
        query = query.neq("id", ignoreProductId);
    const { data, error } = await query;
    if (error)
        return false;
    return (data ?? []).length > 0;
}
