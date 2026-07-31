# Checklist Manual — Política de Descontos no PDV

Ambiente: PDV (`/vendas` → Nova Venda) com política padrão
(`maxPercent = 5%`, `allowedMethods = ["pix", "cash"]`,
`enforcement = "request_manager"`).

> Dica: abra o DevTools → Console para acompanhar as linhas
> `[discount-policy] { ..., result: ... }` — indicam a causa
> (`no_discount` / `disabled_by_method` / `ok` / `exceeds` /
> `disabled_by_policy`) sem poluir a UI.

## 1) Desconto R$ 0,00 — nunca bloqueia

| Passo | Ação | Esperado |
|-------|------|----------|
| 1.1 | Adicione 1 item, desconto = **0,00**, método = **PIX** | Sem toast; botão "Finalizar" habilitado; log `result: no_discount` |
| 1.2 | Mesmo carrinho, troque para **Crédito parcelado 3x** | Sem toast; sem bloqueio; log `result: no_discount` |
| 1.3 | Mesmo carrinho, troque para **Boleto** e **Link** | Sem toast; sem bloqueio em nenhum |

## 2) PIX à vista — permite desconto

| Passo | Ação | Esperado |
|-------|------|----------|
| 2.1 | Subtotal R$ 1.000, desconto **R$ 30 (3%)**, método = **PIX (Bella Pay)** | Desconto aplicado; log `result: ok`, `percent≈3` |
| 2.2 | Mesmo cenário com método = **PIX Próprio (pix_manual)** | Desconto aplicado (regra pelo atributo `kind`, não pelo nome); log `result: ok` |
| 2.3 | Mesmo cenário com **Dinheiro** e **Débito** | Desconto aplicado em ambos |
| 2.4 | Subtotal R$ 1.000, desconto **R$ 200 (20%)**, método = **PIX** | Solicita aprovação de gerente (enforcement `request_manager`); log `result: exceeds` |

## 3) PIX / à vista fora da política — regressão

| Passo | Ação | Esperado |
|-------|------|----------|
| 3.1 | Em Configurações › Vendas, **desmarque PIX** de allowedMethods | Política salva |
| 3.2 | Volte ao PDV, desconto R$ 30 em **PIX Próprio** | Ainda permite (PIX é `cash` via registro); log `result: ok` |
| 3.3 | Restaure PIX na política antes de seguir | — |

## 4) Métodos deferidos — bloqueio quando desconto > 0

| Passo | Ação | Esperado |
|-------|------|----------|
| 4.1 | Desconto R$ 30, método = **Crédito parcelado (credit_card)** | Toast "Desconto disponível apenas para pagamentos à vista"; botão bloqueado; log `result: disabled_by_method` |
| 4.2 | Idem para **Boleto** e **Link de pagamento** | Mesmo bloqueio |
| 4.3 | Em Configurações, adicione `credit_card` a allowedMethods; repita 4.1 | Desconto liberado; log `result: ok` |

## 5) Política desabilitada

| Passo | Ação | Esperado |
|-------|------|----------|
| 5.1 | Desative a política (Configurações › Vendas) | Campo de desconto desabilitado no PDV; log `result: disabled_by_policy` |

## Critérios de aceite

- Nenhum toast/bloqueio quando `desconto = 0,00`, em qualquer método.
- PIX / PIX Próprio / Dinheiro / Débito **sempre** permitem desconto
  quando > 0 (regra pelo atributo `kind`, não pelo rótulo).
- Crédito, Boleto e Link seguem bloqueados a menos que estejam em
  `allowedMethods`.
- Console mostra a causa exata para cada avaliação (`no_discount` /
  `disabled_by_method` / `ok` / `exceeds` / `disabled_by_policy`).
