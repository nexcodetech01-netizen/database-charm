/**
 * Pedido conversacional da Bella (WhatsApp inbound) — parsing e formatação.
 *
 * Camada PURA: interpreta a intenção (adicionar / remover / ver / limpar) e
 * formata as mensagens. O estado do carrinho vive em `cart-session.ts`.
 * NÃO cria venda, não reserva estoque, não altera financeiro, CRM, catálogo,
 * cadastro nem qualquer motor oficial do ERP.
 */
import { normalize } from "./catalog-nav";
const VIEW_RE = /\b(ver|mostrar?|mostra|meu|qual)\s+(o\s+|meu\s+)?(pedido|carrinho|sacola)\b|^\s*(pedido|carrinho|sacola)\s*$/;
const CLEAR_RE = /\b(limpar|limpa|zerar|cancelar|esvaziar|apagar)\s+(o\s+|meu\s+)?(pedido|carrinho|sacola)\b/;
const REMOVE_RE = /\b(remover|remove|tira|tirar|tire|retirar|excluir|exclui)\s+(o\s+|a\s+|os\s+|as\s+)?(.*)$/;
const ADD_RE = /\b(quero|queria|vou querer|me ve|me da|adiciona(r)?|adicione|inclui(r)?|coloca(r)?|manda|pode ser|pode adicionar|leva(r)?|levo|aceito|fico com)\b/;
/** "essa", "esse", "essa aí", "esta" → refere-se ao último produto mostrado. */
const ANAPHORA_RE = /\b(essa|esse|esta|este|isso|ela|ele|a mesma|o mesmo)\b/;
const ORDINALS = {
    primeira: 1, primeiro: 1, segunda: 2, segundo: 2, terceira: 3, terceiro: 3,
    quarta: 4, quarto: 4, quinta: 5, quinto: 5, sexta: 6, sexto: 6,
};
const NUMBER_WORDS = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};
/** Quantidade explícita: "2 bolsas", "quero duas", "x2". */
export function parseQuantity(text) {
    const t = normalize(text);
    const digits = t.match(/(?:^|\s)x?\s*(\d{1,2})(?:\s|$)/);
    if (digits) {
        const n = Number(digits[1]);
        if (n >= 1 && n <= 99)
            return n;
    }
    for (const [w, n] of Object.entries(NUMBER_WORDS)) {
        if (n > 1 && new RegExp(`(^|\\s)${w}(\\s|$)`).test(t))
            return n;
    }
    return 1;
}
/** Posição citada pelo cliente: "remover a segunda", "tira o item 2". */
export function parseOrdinal(text) {
    const t = normalize(text);
    for (const [w, n] of Object.entries(ORDINALS)) {
        if (new RegExp(`(^|\\s)${w}(\\s|$)`).test(t))
            return n;
    }
    const item = t.match(/\bitem\s+(\d{1,2})\b/);
    if (item)
        return Number(item[1]);
    return null;
}
export function parseCartCommand(text) {
    const t = normalize(text);
    if (!t)
        return null;
    if (CLEAR_RE.test(t))
        return { kind: "clear" };
    if (VIEW_RE.test(t))
        return { kind: "view" };
    const rm = t.match(REMOVE_RE);
    if (rm) {
        const rest = (rm[3] ?? "").trim();
        return {
            kind: "remove",
            text: rest && !parseOrdinal(rest) ? rest : null,
            ordinal: parseOrdinal(t),
        };
    }
    return null;
}
export function hasAddIntent(text) {
    return ADD_RE.test(normalize(text));
}
/** "Quero essa" / "Pode adicionar" — sem nome de produto na frase. */
export function isAnaphoricAdd(text) {
    const t = normalize(text);
    if (!hasAddIntent(t))
        return false;
    return ANAPHORA_RE.test(t) || /^(pode adicionar|adiciona|adicionar|aceito|levo)\b/.test(t);
}
const STOP = new Set([
    "quero", "queria", "vou", "me", "ve", "da", "de", "do", "das", "dos",
    "o", "a", "os", "as", "um", "uma", "adicionar", "adiciona", "adicione",
    "incluir", "inclui", "colocar", "coloca", "manda", "pode", "ser", "levar",
    "leva", "levo", "aceito", "fico", "com", "por", "favor", "e", "no", "na",
    "pedido", "carrinho", "sacola", "essa", "esse", "esta", "este", "isso",
]);
function tokens(text) {
    return normalize(text)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
}
/**
 * Casa a mensagem com UM produto ativo. Retorna `null` se não houver certeza
 * (nenhum candidato ou empate entre produtos).
 */
export function matchProduct(text, products) {
    const t = normalize(text);
    if (!t || products.length === 0)
        return null;
    const contained = products.filter((p) => {
        const n = normalize(p.name);
        return n.length >= 3 && t.includes(n);
    });
    if (contained.length > 0) {
        return contained.sort((a, b) => b.name.length - a.name.length)[0];
    }
    const words = tokens(text);
    if (words.length === 0)
        return null;
    const scored = [];
    for (const product of products) {
        const nameWords = new Set(tokens(product.name));
        if (nameWords.size === 0)
            continue;
        let hits = 0;
        for (const w of words)
            if (nameWords.has(w))
                hits += 1;
        if (hits === 0)
            continue;
        scored.push({ product, score: hits / nameWords.size + hits / words.length });
    }
    if (scored.length === 0)
        return null;
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (top.score < 1)
        return null;
    if (scored[1] && scored[1].score === top.score)
        return null;
    return top.product;
}
/** Localiza um item do carrinho por texto livre. */
export function findCartItemIndex(session, text) {
    const t = normalize(text);
    if (!t)
        return -1;
    return session.items.findIndex((i) => {
        const n = normalize(i.name);
        return n === t || n.includes(t) || t.includes(n);
    });
}
// ---------------------------------------------------------------- formatação
export function money(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    })
        .format(Number.isFinite(value) ? value : 0)
        .replace(/\u00a0/g, " ");
}
function itemBlock(item) {
    return [`• *${item.name}* — *${money(item.subtotal)}*`, `(Qtd: ${item.qty})`].join("\n").split("\n");
}
/** Resumo padrão do pedido: itens + total. */
export function formatCartSummary(session) {
    const blocks = session.items.map((i) => `• *${i.name}* (x${i.qty}) — *${money(i.subtotal)}*`);
    return [...blocks, "", `*Total: ${money(session.total)}*`].join("\n");
}
export function formatCartUpdatedMessage(session) {
    return [
        "🛍️ *Pedido atualizado!*",
        "",
        formatCartSummary(session),
        "",
        "Gostaria de adicionar algo mais ou prefere finalizar o seu pedido agora? 😊",
    ].join("\n");
}
export function formatCartMessage(session) {
    if (session.items.length === 0) {
        return [
            "O seu pedido ainda está vazio! 🛍️",
            "",
            "Que tal dar uma olhadinha no nosso catálogo para escolher algo especial? Me avise o que você procura! 😊",
        ].join("\n");
    }
    return [
        "🛍️ *Aqui está o seu pedido:*",
        "",
        formatCartSummary(session),
        "",
        "Deseja continuar comprando ou vamos finalizar o seu pedido? 😊",
    ].join("\n");
}
export function formatRemovedMessage(removed, session) {
    if (!removed) {
        return "Poxa, não encontrei esse item no seu pedido. Pode me confirmar o nome do produto que você deseja retirar? 😊";
    }
    if (session.items.length === 0) {
        return `Prontinho! Removi *${removed.name}* e o seu pedido está vazio agora. 🛍️`;
    }
    return [
        `Certo! Removi *${removed.name}* do seu pedido.`,
        "",
        "🛍️ *Pedido atualizado:*",
        "",
        formatCartSummary(session),
        "",
        "Gostaria de ver mais alguma coisa ou podemos finalizar? 😊",
    ].join("\n");
}
export function formatClearedMessage() {
    return "Tudo limpo! Esvaziei o seu pedido. 🛍️\n\nQuando quiser recomeçar, é só me chamar! 😊";
}
export function formatAmbiguousAddMessage() {
    return "Com certeza! Me diga o nome do produto que você gostaria de adicionar ao seu pedido. 😊";
}
