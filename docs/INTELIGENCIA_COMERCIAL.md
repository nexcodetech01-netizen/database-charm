# Inteligência Comercial — Blueprint Arquitetural

> Documento de arquitetura (Sprint 2.2 + hardening A0.1). **Não contém código, migrations, componentes ou rotas.** Este blueprint é a fonte de verdade para a implementação futura do módulo *Inteligência Comercial* do NexOS.
>
> **STATUS: 🟢 ARQUITETURA CONGELADA (Sprint A0.1).** As seções §17–§29 abaixo são o *contrato normativo*. Onde §1–§16 conflitarem com §17+, **§17+ prevalece** (mantidos por rastreabilidade histórica). ADRs em `docs/architecture/ADR-001..010` são vinculantes.

---

## 1. Problemas que o módulo resolve

O NexOS hoje trata precificação como um cálculo local, isolado e manual. Isso gera problemas concretos observados na operação real da Bella Bolsas e replicáveis em qualquer PME:

1. **Precificação sem método.** O lojista chuta preço, aplica markup fixo ou copia o concorrente. Não existe garantia de margem mínima.
2. **Cálculo duplicado.** Produto, Compra, Venda, Simulador e Dashboard hoje calculam margem cada um do seu jeito — divergência inevitável.
3. **Custo desatualizado.** O custo médio ponderado existe no banco, mas não é combinado com frete/seguro/rateio de forma unificada ao precificar.
4. **Canais ignorados.** Vender no Mercado Livre (12% comissão) pelo mesmo preço da loja física destrói a margem sem que o operador perceba.
5. **Sem política corporativa.** Não há um lugar único onde a empresa declare “margem mínima 15%, ideal 30%, premium 45%, arredondar em ,90”.
6. **Sem hierarquia.** Categoria “Bolsas Premium” deveria ter margem diferente de “Acessórios de queima”, mas hoje tudo é tratado igual.
7. **Bella IA sem base numérica.** Sem um motor confiável, qualquer recomendação de IA é opinião — não evidência.
8. **Impossível auditar.** Ninguém consegue responder: *“por que este produto está R$ 149,90?”*. Falta rastreabilidade da origem da política aplicada.

**Missão do módulo:** transformar precificação em um ativo estratégico — auditável, hierárquico, multicanal e consumível por qualquer módulo através de um único motor.

---

## 2. Entidades de negócio

Nomes lógicos (não são tabelas). Cada uma é um agregado de domínio.

| Entidade | Propósito |
|---|---|
| **CompanyPricingPolicy** | Política raiz da empresa (impostos, despesas fixas, arredondamento, canal padrão, margens-piso globais). |
| **CategoryPricingPolicy** | Política por categoria (margens, embalagem padrão, estratégia sugerida). Sobrescreve empresa. |
| **ProductPricingOverride** | Exceções pontuais por produto (margem forçada, preço-teto, estratégia específica). Sobrescreve categoria. |
| **Channel** | Canal de venda (Loja, WhatsApp, Instagram, Site, Mercado Livre, Shopee). Cada um com comissão %, taxa fixa, taxa % de gateway, custo operacional. |
| **CostComposition** | Composição de custo de aquisição (custo unitário + frete + seguro + outras despesas + rateios). Origina do módulo Compras. |
| **AllocationStrategy** | Método de rateio de custos indiretos numa compra: `quantity`, `value`, `weight`, `manual`. |
| **PricingStrategy** | Estratégia comercial aplicada: `high_margin`, `high_turnover`, `premium`, `promotion`, `stock_burn`. |
| **PricingContext** | Snapshot imutável entregue ao motor (produto + custo + categoria + política + canal + estratégia). |
| **PricingResult** | Resultado retornado pelo motor (ver §6). |
| **PricingDecision** | Log auditável: qual política foi aplicada, de onde veio, quando, por quem/qual módulo. |

---

## 3. Regras de negócio

### 3.1 Hierarquia de políticas (precedência)

```
ProductPricingOverride  →  CategoryPricingPolicy  →  CompanyPricingPolicy  →  System Defaults
```

- Cada campo é resolvido **individualmente** (merge por atributo, não substituição em bloco).
- Exemplo: um produto pode sobrescrever apenas `minMargin`, herdando `packaging` da categoria e `rounding` da empresa.
- O `PricingResult` sempre declara a **origem** de cada campo aplicado (`source: 'product' | 'category' | 'company' | 'default'`).

**Vantagens:**
- Configuração DRY: define-se uma vez na empresa, refina-se por categoria, excepcionaliza-se por produto.
- Auditabilidade completa: qualquer preço é justificável até a fonte.
- Onboarding rápido: uma empresa nova opera com defaults; sofisticação é opcional.

### 3.2 Regras invariantes

1. **Piso absoluto.** Nenhum preço sugerido pode violar `minMargin` da política resolvida.
2. **Idempotência.** Mesma entrada → mesmo resultado. O motor é puro.
3. **Determinismo temporal.** O motor recebe a política *snapshotada* — não lê banco.
4. **Isolamento monetário.** Todo cálculo em centavos (inteiros) internamente; formatação apenas na borda.
5. **Multicanal.** Preço sem canal é preço-base; preço com canal aplica comissão/taxa/custo do canal.
6. **Custo mínimo.** Sem `CostComposition` válida, o motor recusa com erro semântico (`INSUFFICIENT_COST_DATA`).
7. **Arredondamento é última etapa.** Sempre pós-margem, pós-taxa, pós-estratégia.
8. **Estratégia não quebra piso.** `promotion` e `stock_burn` podem reduzir margem, mas nunca abaixo do `minMargin` — a menos que explicitamente autorizado por override.

### 3.3 Rateio de custos (Compras)

- `AllocationStrategy` é declarada **por linha de despesa acessória** da compra (frete, seguro, taxa de importação).
- Estratégias suportadas (arquitetura preparada, implementação em fases):
  - `quantity`: divide igualmente pelo total de unidades.
  - `value`: proporcional ao valor da linha de item.
  - `weight`: proporcional ao peso (exige cadastro de peso no produto).
  - `manual`: operador informa o valor por item.
- O motor **não faz rateio**. Compras entrega ao motor a `CostComposition` já resolvida.

---

## 4. Arquitetura

### 4.1 Camadas

```
┌────────────────────────────────────────────────────────────┐
│  Consumidores: Produtos, Compras, Vendas, Financeiro,      │
│  Dashboard, Relatórios, Bella IA, WhatsApp, Marketplace    │
└──────────────────────────┬─────────────────────────────────┘
                           │  chamadas puras (objetos)
                           ▼
┌────────────────────────────────────────────────────────────┐
│  PRICING ENGINE (núcleo puro — sem I/O, sem banco)         │
│  • resolvePolicy(product, category, company)                │
│  • composeCost(purchase, product)                           │
│  • applyChannel(price, channel)                             │
│  • applyStrategy(price, strategy, policy)                   │
│  • round(price, rounding)                                   │
│  • evaluate(price, context)  → PricingResult                │
│  • compute(context)          → PricingResult                │
└──────────────────────────┬─────────────────────────────────┘
                           │  usa
                           ▼
┌────────────────────────────────────────────────────────────┐
│  DOMAIN TYPES (contratos imutáveis)                         │
│  PricingPolicy · Channel · CostComposition · Strategy · …   │
└──────────────────────────┬─────────────────────────────────┘
                           │  hidratado por
                           ▼
┌────────────────────────────────────────────────────────────┐
│  POLICY RESOLVER (adapter — lê banco/localStorage/API)      │
│  Único ponto autorizado a ler persistência de políticas.    │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Princípios

- **Pureza do motor.** Zero side-effects. Testável com fixtures. Portável (poderia rodar em Edge Function, Worker, CLI).
- **Contratos imutáveis.** DTOs versionados (`PricingContext.v1`). Mudanças exigem nova versão, nunca break.
- **Adapter pattern.** `PolicyResolver` isola persistência. Migrar de localStorage → tabela `pricing_policies` não toca o motor.
- **Auditoria first-class.** Toda chamada relevante gera um `PricingDecision` (log opcional, mas suportado nativamente).
- **Multi-tenant seguro.** Toda entrada é escopada por `companyId`. O motor nunca cruza empresas.

### 4.3 Estrutura de módulo proposta

```
src/features/pricing/
  engine/            ← núcleo puro (funções sem I/O)
  policies/          ← resolver + merge hierárquico
  channels/          ← catálogo e cálculo por canal
  costs/             ← composição e rateios
  strategies/        ← estratégias comerciais
  audit/             ← PricingDecision log
  types/             ← contratos versionados
  index.ts           ← barrel — única API pública
```

Consumidores importam **apenas** de `@/features/pricing`. Internos são privados.

---

## 5. Consumo pelos outros módulos

Todos os módulos consomem o motor pelo **mesmo contrato** — nunca reimplementam cálculo.

| Módulo | Uso | Entrada | Saída consumida |
|---|---|---|---|
| **Produtos** | Sugerir preço no cadastro, exibir badge de saúde | `PricingContext` (produto + política resolvida) | `recommendedPrice`, `status`, `origem` |
| **Compras** | Após receber, recalcular preço sugerido do produto | `CostComposition` nova | `recommendedPrice`, `deltaMargem` |
| **Vendas / PDV** | Validar preço no ato da venda por canal | `PricingContext` + `channel` | `minPrice`, alerta se abaixo |
| **Financeiro** | Reconciliar margem realizada vs. planejada | Venda concretizada + `PricingResult` snapshot | `lucroLiquidoReal` |
| **Dashboard** | KPI de saúde comercial da carteira | Batch de `PricingResult` | agregados por categoria/canal |
| **Relatórios** | Análise histórica de margem por SKU/canal/período | `PricingDecision` log | séries temporais |
| **Bella IA** | Interpretar resultados, sugerir ajustes de política | `PricingResult` + histórico | *nunca calcula — só narra* |
| **WhatsApp** | Cotação rápida no chat com canal WhatsApp | `PricingContext` + `channel=whatsapp` | `recommendedPrice` |
| **Marketplaces** | Preço específico por canal com comissão correta | `PricingContext` + `channel=mercado_livre` | `minPrice`, `recommendedPrice` |
| **Promoções (futuro)** | Aplicar estratégia `promotion` respeitando piso | `PricingContext` + `strategy=promotion` | `promotionalPrice`, validação |

**Regra de ouro:** se um módulo precisa calcular margem/preço/lucro, ele **chama o motor**. Se calcular local, é bug de arquitetura.

---

## 6. Contrato do PricingResult

O motor sempre retorna um objeto único e completo:

```
PricingResult {
  // Custo
  realCost              // custo total unitário (aquisição + acessórios + rateios)
  averageCost           // custo médio ponderado corrente do produto
  costBreakdown         // detalhe por origem (aquisição, frete, seguro, embalagem, …)

  // Preço (por camada)
  minPrice              // baseado em minMargin da política resolvida
  recommendedPrice      // baseado em idealMargin
  premiumPrice          // baseado em premiumMargin
  targetPrice           // baseado em margem desejada informada (opcional)

  // Indicadores
  markup                // (preço - custo) / custo
  margin                // (preço - custo) / preço
  grossProfit           // preço - custo real
  netProfit             // grossProfit - taxas do canal - impostos aplicáveis

  // Contexto
  strategy              // estratégia aplicada
  channel               // canal aplicado (ou null = base)
  rounding              // regra de arredondamento usada

  // Rastreabilidade
  policySource {        // origem de cada atributo aplicado
    minMargin: 'category',
    idealMargin: 'product',
    rounding: 'company',
    …
  }
  warnings []           // ex.: 'cost outdated', 'margin below ideal on channel X'
  version               // versão do contrato
}
```

---

## 7. Empresa — políticas suportadas

| Campo | Descrição |
|---|---|
| `taxes` | Impostos aplicáveis (Simples, ICMS, etc.) — percentual sobre preço. |
| `operationalCosts` | Despesas fixas rateáveis por unidade (opcional). |
| `roundingPolicy` | `none`, `integer`, `end_90`, `end_99`, `psychological`. |
| `defaultChannel` | Canal padrão para cálculos sem canal explícito. |
| `minMargin` / `idealMargin` / `premiumMargin` | Pisos e alvos globais. |
| `defaultStrategy` | Estratégia padrão da empresa. |
| `currency` | Moeda operacional. |
| `packagingDefault` | Custo médio de embalagem quando categoria não define. |

---

## 8. Categoria — políticas suportadas

| Campo | Descrição |
|---|---|
| `minMargin`, `idealMargin`, `premiumMargin` | Sobrescrevem empresa. |
| `packaging` | Custo específico da categoria (ex.: bolsa exige caixa maior). |
| `suggestedStrategy` | Estratégia recomendada (ex.: Acessórios → `high_turnover`). |
| `channelOverrides` | Ajustes de margem por canal para produtos da categoria. |
| `roundingOverride` | Sobrescreve arredondamento da empresa (raro). |

---

## 9. Produto — overrides suportados

| Campo | Descrição |
|---|---|
| `minMargin`, `idealMargin`, `premiumMargin` | Exceção pontual. |
| `packaging` | Embalagem específica do SKU. |
| `forcedStrategy` | Trava a estratégia (ex.: item de queima permanente). |
| `priceCeiling` | Preço-teto absoluto (regulatório, MAP). |
| `priceFloor` | Piso absoluto além do calculado por margem. |
| `channelOverrides` | Ajustes por canal específicos do produto. |

---

## 10. Compras — composição de custo

`CostComposition` entregue ao motor:

```
CostComposition {
  acquisitionCost       // valor de nota
  freight               // rateado conforme AllocationStrategy
  insurance             // rateado
  otherExpenses []      // taxas, importação, despachante
  allocations []        // registro do método usado por linha
  perUnitCost           // resultado final unitário
  source                // referência à compra origem
  computedAt            // timestamp
}
```

O rateio ocorre no módulo Compras (não no motor), respeitando `AllocationStrategy` da linha. O motor recebe apenas o `perUnitCost` já composto — mas o `costBreakdown` acompanha para auditoria.

---

## 11. Canais

`Channel` é entidade de primeira classe:

```
Channel {
  id, name, type            // 'physical' | 'social' | 'own_site' | 'marketplace'
  commissionPct             // ex.: Mercado Livre 12%
  fixedFee                  // ex.: R$ 5 por venda
  gatewayFeePct             // taxa de pagamento
  operationalCost           // custo fixo de operação do canal (por venda)
  minMarginOverride         // margem mínima específica do canal
  active
}
```

O motor aplica canal como uma **camada de correção** sobre o preço base: `netPrice = grossPrice · (1 − commission − gatewayFee) − fixedFee − operationalCost`.

---

## 12. Estratégias comerciais

Cada estratégia é um **modificador declarativo** aplicado sobre a margem-alvo:

| Estratégia | Efeito no motor |
|---|---|
| `high_margin` | Usa `premiumMargin` como alvo. |
| `high_turnover` | Usa `minMargin + delta` para giro rápido. |
| `premium` | `premiumMargin` + arredondamento psicológico agressivo. |
| `promotion` | Aplica desconto declarado, valida piso. |
| `stock_burn` | Permite chegar ao `priceFloor`, avisa perda de margem. |

Estratégias são **plugáveis**: novas estratégias implementam o mesmo contrato (`apply(context) → adjustedContext`) e são registradas no motor.

---

## 13. Bella IA

**Regra absoluta:** Bella IA **nunca calcula preço**.

Fluxo correto:
1. Bella coleta contexto (produto, histórico, mercado).
2. Bella pede ao motor: *“compute este PricingContext”*.
3. Motor retorna `PricingResult`.
4. Bella **interpreta e narra**: *“seu produto está 8% abaixo da margem ideal no Mercado Livre — sugiro subir para R$ 189,90.”*
5. Bella pode propor **mudança de política** (ex.: “aumentar `idealMargin` de Acessórios para 35%”), mas a alteração é **explícita, humana e auditada**.

Isso garante: consistência entre o que a IA fala e o que o sistema calcula; ausência de alucinação numérica; rastreabilidade.

---

## 14. Roadmap de implementação

### Fase 1 — Fundação (motor + política empresa)
- Types e contratos versionados.
- `PricingEngine` puro com `compute` e `evaluate`.
- `CompanyPricingPolicy` persistida (evolução do atual `usePricingPolicy`).
- Simulador standalone (evolução do atual).
- Testes unitários com fixtures.

### Fase 2 — Hierarquia + Produto
- `CategoryPricingPolicy` + resolver hierárquico.
- `ProductPricingOverride`.
- Integração com módulo Produtos (badge de saúde + preço sugerido).
- Integração com Compras (recomputar sugestão após recebimento).

### Fase 3 — Canais + Dashboard
- Entidade `Channel` + cadastro.
- Aplicação de canal no motor.
- Dashboard de saúde comercial (agregado por categoria/canal).
- Histórico via `PricingDecision`.
- Relatórios de margem realizada.

### Fase 4 — Estratégias + Inteligência
- Registry de estratégias.
- Bella IA consumindo motor (recomendações + narrativa).
- Ajuste automático supervisionado (Bella propõe, humano aprova).
- Marketplaces (preço por canal automatizado).
- Promoções e queima com validação de piso.

### Fase 5 — Ecosistema
- Regras fiscais por regime (Simples, Lucro Presumido, Real).
- Rateios avançados (peso, manual).
- Precificação dinâmica (concorrência, demanda).
- API pública do Pricing Engine.

---

## 15. Autocrítica

### 15.1 Pontos fracos identificados

1. **Complexidade da hierarquia.** Merge por atributo é poderoso mas confunde o usuário. **Mitigação:** UI de política deve sempre mostrar “valor efetivo” + “origem” lado a lado.
2. **Snapshot vs. dinamismo.** Motor puro exige snapshot da política — mudanças de política não recalculam automaticamente preços vigentes. **Mitigação:** job de reavaliação em background + notificação de drift.
3. **Custo médio depende de banco.** O `averageCost` vem de um trigger SQL. Se o trigger falha, o motor recebe custo errado. **Mitigação:** motor exige `computedAt` na `CostComposition` e emite warning se stale.
4. **Canal como camada linear.** Realidade tem regras não-lineares (frete grátis acima de X, tier de comissão por volume). **Mitigação:** contrato `Channel` deve permitir função customizada opcional já na v1.
5. **Estratégias podem colidir.** `promotion` + `stock_burn` simultâneas? **Mitigação:** motor aceita **uma** estratégia por chamada; combinações são estratégias novas explícitas.
6. **Impostos são um monstro.** Simples Nacional muda por faixa de faturamento; ICMS varia por UF de destino. **Mitigação:** tratar tributação como *engine* separado que **alimenta** o Pricing Engine — não misturar responsabilidades.
7. **Auditoria pode explodir em volume.** `PricingDecision` para cada consulta gera muitos logs. **Mitigação:** log opt-in por consumidor + retenção configurável + agregação para relatórios.
8. **Multi-moeda ausente.** Não previsto para PME BR, mas cerceia expansão futura. **Mitigação:** `currency` já no contrato desde a v1, mesmo que sempre BRL.

### 15.2 Riscos futuros

- **Deriva de conhecimento.** Se um módulo calcular preço local “temporariamente”, vira débito permanente. **Mitigação:** lint arquitetural + code review bloqueante.
- **Explosão de estratégias.** Cada exceção comercial vira uma estratégia nova. **Mitigação:** estratégias exigem RFC interno antes de entrar no registry.
- **Bella IA tentando burlar.** Prompt engineering pode fazer IA “calcular” e responder direto. **Mitigação:** guardrails no prompt + validação de saída.
- **Performance em batch.** Dashboard pode precisar computar 10k produtos. **Mitigação:** motor puro é trivialmente paralelizável; cache de política por `(companyId, categoryId)`.

### 15.3 Limitações assumidas

- Não resolve **pricing dinâmico por demanda** na v1.
- Não resolve **precificação por cliente** (B2B com tabela) na v1 — mas contrato aceita `customerSegment` opcional.
- Não substitui **motor fiscal**.

### 15.4 Melhorias propostas

1. **Versionamento de contrato desde o dia 1** (`PricingContext.v1`, `PricingResult.v1`).
2. **`PolicyResolver` como interface** — permite trocar localStorage → Supabase → API externa sem tocar consumidores.
3. **Fixtures canônicas de teste** compartilhadas entre motor, UI e Bella IA — mesma verdade para todos.
4. **Feature flag por estratégia** — permite lançar `stock_burn` para 10% das empresas antes de generalizar.
5. **Health check do motor** exposto em Configurações: “sua política está saudável?” (detecta contradições — ex.: `minMargin > idealMargin`).

---

## 16. Definição de pronto (para a Fase 1)

- [ ] Types v1 congelados e documentados.
- [ ] Motor puro com 100% de cobertura em fixtures.
- [ ] `PolicyResolver` isolado atrás de interface.
- [ ] Simulador consumindo o motor (zero cálculo local).
- [ ] Documentação de API pública em `src/features/pricing/README.md`.
- [ ] Nenhum outro módulo calcula margem/preço fora do motor.

---

**Este blueprint é o contrato arquitetural.** Qualquer implementação futura deve referenciá-lo. Divergências exigem atualização deste documento **antes** do código.

---

# PARTE II — Hardening A0.1 (Normativo — Arquitetura Congelada)

> As seções a seguir consolidam a revisão arquitetural independente e são **vinculantes**. Substituem §1–§16 nos pontos de conflito. Todo ADR referenciado é obrigatório.

## 17. Bounded Contexts (revisitados — ADR-006, ADR-010)

Cada contexto é dono do seu próprio modelo. **Nenhum contexto conhece detalhes internos de outro.** Comunicação exclusivamente por contratos versionados (DTOs) ou eventos de domínio.

| Contexto | Responsabilidade única | Não faz |
|---|---|---|
| **Pricing** | Calcular preço a partir de contexto imutável. | Persistir venda, calcular imposto, decidir canal. |
| **Tax** | Calcular tributação (produz `TaxQuote`). | Calcular margem ou preço. |
| **Sales** | Orquestrar venda, escolher canal, pedir cotação. | Calcular preço; consome `PricingResult`. |
| **Finance** | Reconciliar realizado vs. planejado. | Recalcular; consome snapshot do `PricingResult`. |
| **Inventory** | Estoque + custo médio. | Precificar; entrega `CostComposition` estabilizada. |
| **Products** | Cadastro, categoria, overrides. | Calcular; expõe `ProductPricingOverride` como dado. |
| **Marketing** | Campanhas, promoções. | Calcular; propõe `PromotionRequest`, motor valida. |
| **Bella IA** | Interpretar/narrar/propor. | Calcular preço/imposto (consome `explain()`). |

Regra de fronteira: **um contexto só chama outro pelo contrato público**. Compras não importa do Pricing, entrega `CostComposition`. Sales não sabe como Pricing calcula, apenas envia `PricingContext` e lê `PricingResult`.

---

## 18. Pricing Engine — API pública mínima (ADR-001)

A **única** superfície pública do motor é:

```
compute(context: PricingContext.vN)  → PricingResult.vN
explain(result: PricingResult.vN)    → PricingExplanation.vN
```

Todo o resto (`resolvePolicy`, `applyChannel`, `applyStrategy`, `round`, `composeCost`, `evaluate`) é **interno** — não exportado do barrel `@/features/pricing`. Consumidores externos que precisem de uma decisão isolada devem obtê-la via `explain(result)`.

Motor é **puro**: sem I/O, sem clock, sem random. Clock e FX entram pelo `PricingContext` (§21).

---

## 19. Tax Engine — domínio separado (ADR-002)

Impostos **saem** do Pricing Engine. Novo domínio `Tax` responde por:

```
computeTax(taxContext) → TaxQuote.vN
```

Contrato conceitual de `TaxQuote` (sem implementação):

```
TaxQuote.v1 {
  regime              // 'simples' | 'presumido' | 'real' | 'mei'
  breakdown []        // [{ code:'ICMS'|'PIS'|'COFINS'|'IPI'|'ISS'|'DAS', pct, fixed, base }]
  totalPctOnPrice     // taxa efetiva sobre preço final
  totalFixed          // parcela fixa por unidade
  jurisdiction        // { originUF, destUF, destMunicipality? }
  validFrom, validTo  // janela de validade da cotação
  taxEngineVersion
  quoteId             // idempotência
}
```

Pricing **nunca calcula** imposto. Recebe `TaxQuote` já pronta e a aplica como camada linear (percentual + fixo). Se `TaxQuote` ausente e política exige tributo, motor emite warning `TAX_QUOTE_MISSING` e devolve preço pré-imposto marcado.

Racional: legislação tributária BR muda mensalmente; isolar o Tax Engine permite deploys/atualizações fiscais sem tocar Pricing.

---

## 20. Channel — pertence a Sales (ADR-006)

`Channel` **sai** do domínio Pricing. Passa a ser cadastro de Sales. O motor recebe apenas:

```
ChannelContract.v1 {
  channelId
  variableFeePct      // comissão + gateway consolidados
  fixedFeePerOrder    // R$ por venda
  operationalCost     // custo fixo alocado por unidade
  minMarginOverride?  // piso específico do canal (opcional)
  nonLinearRules?     // função opcional descritiva (ver §29 warnings)
  version
}
```

Sales resolve o canal → produz `ChannelContract` → injeta no `PricingContext`. Pricing não conhece "Mercado Livre" — conhece um `ChannelContract` com percentuais.

---

## 21. PricingContext v1 — CONGELADO (ADR-004)

Contrato **imutável e versionado**. Campos não usados na Fase 1 permanecem no schema (opcionais) para evitar breaks futuros.

```
PricingContext.v1 {
  contextVersion:        'pricing-context/1'

  company:               CompanySnapshot          // id, currency, defaults
  category?:             CategorySnapshot         // políticas herdadas
  product:               ProductSnapshot          // id, sku, overrides
  channel?:              ChannelContract.v1       // §20
  customerSegment?:      { id, tier }             // B2B/varejo (não usado v1)
  quantity:              number                   // default 1
  store?:                { id, region }           // multi-loja (não usado v1)
  currency:              'BRL' | ISOCode          // v1 sempre BRL
  clock:                 { now: ISO8601, tz }     // injetado — motor não lê Date.now
  taxQuote?:             TaxQuote.v1              // §19
  priceList?:            PriceListEntry.v1        // §23 — se presente, muda modo
  fxRate?:               { base, quote, rate }    // multi-moeda futuro
  costComposition:       CostComposition.v1       // §26

  marginTarget?:         MarginTargetSpec         // §22
  commercialBehavior?:   CommercialBehaviorSpec   // §22
  roundingPolicy?:       RoundingPolicySpec       // §22

  requestId              // idempotência/tracing
  requestedBy            // { module, userId? }   // auditoria
}
```

Regra: **adicionar campo é minor** (novo opcional). **Remover/renomear é major** (nova versão + compat N-1 obrigatória — ADR-008).

---

## 22. Estratégias ortogonais (ADR-001)

O objeto único `PricingStrategy` é **abolido**. Passam a existir três eixos independentes, combináveis:

| Eixo | Papel | Exemplos |
|---|---|---|
| **MarginTarget** | Qual margem perseguir. | `min`, `ideal`, `premium`, `custom(pct)` |
| **CommercialBehavior** | Como se comportar comercialmente. | `standard`, `high_turnover`, `promotion(discountSpec)`, `stock_burn` |
| **RoundingPolicy** | Como arredondar o preço final. | `none`, `integer`, `end_90`, `end_99`, `psychological` |

Vantagens:
- **Combinatória explícita** (ex.: `premium` + `stock_burn` + `end_99` é válido; regras de conflito ficam no motor, não escondidas no nome).
- Nenhuma estratégia "monolítica" cresce sem controle.
- Testes ficam ortogonais (matriz pequena).
- Bella IA propõe alterações por eixo, não por preset.

Regra invariante: nenhuma combinação pode furar `minMargin` sem override explícito assinado.

---

## 23. Price List (PriceBook) (ADR-003)

O motor suporta **dois modos** de precificação:

| Modo | Quando usar | Fluxo |
|---|---|---|
| **Derived** (calculado) | Padrão. Preço nasce do custo + política. | `compute(context)` sem `priceList` → aplica hierarquia. |
| **Tabelado** (PriceList) | Contratos B2B, campanha de rede, MAP de fornecedor, preço regulado. | `compute(context)` com `priceList` presente → motor **usa** o preço tabelado e apenas **valida** contra piso/tributo/canal. |

Contrato:

```
PriceList.v1 {
  priceListId, name, priority
  scope: { channels?, customerSegments?, stores?, validFrom, validTo }
  entries: [{ productId, price, currency, minQty?, maxQty? }]
  fallback: 'derived' | 'reject'   // se SKU não estiver na tabela
  version
}
```

Precedência: **PriceList (ativa+aplicável) → Derived**. Se ambos existirem, PriceList vence e o `PricingResult` marca `mode: 'tabled'` com `sourceListId`. Se o preço tabelado violar piso, motor emite warning `TABLED_PRICE_BELOW_FLOOR` mas **não sobrescreve** (respeita contrato humano); cabe a Sales bloquear.

Coexistência: uma empresa opera hoje em Derived; adiciona uma PriceList para uma rede de revenda amanhã sem tocar código.

---

## 24. PricingResult v1 — expandido (ADR-005, ADR-008, ADR-011 auditoria)

```
PricingResult.v1 {
  resultVersion:         'pricing-result/1'
  mode:                  'derived' | 'tabled'

  // Preços (sempre em centavos internamente, formatação na borda)
  minPrice, recommendedPrice, premiumPrice, targetPrice
  finalPrice             // preço a apresentar (após rounding + estratégia)

  // Indicadores
  costTotal, margin, markup, grossProfit, netProfit

  // Camadas aplicadas
  appliedRules: [        // ordem determinística
    { step:'cost',      detail },
    { step:'target',    detail },
    { step:'behavior',  detail },
    { step:'channel',   detail },
    { step:'tax',       detail },
    { step:'pricelist', detail? },
    { step:'rounding',  detail },
    { step:'floor',     detail }
  ]

  // Origem de cada atributo aplicado (merge por atributo — §3.1)
  policySource: { minMargin:'category', idealMargin:'product', … }

  // Versões (auditoria — ADR-011)
  engineVersion          // ex.: 'pricing-engine/1.4.2'
  calculationVersion     // ex.: 'calc/2025-11-A'
  policyVersion          // hash imutável da política resolvida
  contextVersion         // 'pricing-context/1'
  taxEngineVersion?

  // Rastreabilidade
  requestId
  explainId              // chave para explain()
  computedAt             // do clock injetado
  warnings: []           // §29
}
```

`policyVersion` é hash determinístico do snapshot resolvido — permite reproduzir cálculo anos depois.

---

## 25. explain() — API narrativa (ADR-005, ADR-009)

Toda decisão do motor é explicável. Contrato conceitual:

```
PricingExplanation.v1 {
  explainId
  summary                 // 1 linha humana ("R$ 189,90 = custo R$ 92 + margem 45% (categoria) + canal 12% + arredondamento ,90")
  steps: [                // ordem exata do cálculo (espelha appliedRules)
    { step, input, output, rule, source }
  ]
  policyResolutionTree    // por campo: quem venceu e por quê
  invariantsChecked: [{ name, passed, detail }]
  warnings
  suggestedActions?       // ex.: 'aumentar minMargin para 20%'
}
```

**Bella IA consome `explain()`. Nunca reconstrói cálculo.** Se Bella tentar recalcular localmente, é bug de arquitetura (ADR-009). Prompt e guardrails forçam a IA a citar `explainId`.

---

## 26. CostComposition v1 (ADR-004, mantém §10)

```
CostComposition.v1 {
  version:               'cost-composition/1'
  acquisitionCost        // último custo de nota (centavos)
  weightedAverageCost    // custo médio ponderado (fonte da verdade p/ margem)
  freight, insurance, packaging
  otherExpenses: [{ code, amount, allocation }]
  perUnitCost            // resultado composto final
  allocationsUsed: []    // registro dos métodos por linha
  sourcePurchaseIds: []
  computedAt             // p/ detectar stale
  staleThresholdDays?    // política, default 30
  origin                 // 'inventory' | 'purchase' | 'manual'
}
```

Motor rejeita com `INSUFFICIENT_COST_DATA` se ausente; emite warning `COST_STALE` se `computedAt` > threshold.

---

## 27. Domain Events — contratos (ADR-007)

Eventos de domínio (contratos, não implementação). Nenhum contexto reage sem contrato explícito.

| Evento | Emissor | Payload chave | Consumidores típicos |
|---|---|---|---|
| `PolicyChanged.v1` | Products/Config | policyId, scope (company/cat/product), before, after, actor, occurredAt | Pricing (invalida cache), Bella IA, Auditoria |
| `CostRecomputed.v1` | Inventory | productId, oldWAC, newWAC, computedAt | Pricing (reavaliação), Dashboard, Bella IA |
| `PriceRecommended.v1` | Pricing | productId, contextRef, resultVersion, explainId | Bella IA, Marketing, Sales |
| `PriceApplied.v1` | Sales | saleId, productId, appliedPrice, resultSnapshot, explainId | Finance (reconciliação), Auditoria, Relatórios |
| `PriceListChanged.v1` | Products/Config | priceListId, version, scope, effectiveFrom | Pricing, Sales, Bella IA |
| `TaxQuoteIssued.v1` | Tax | quoteId, jurisdiction, validTo | Pricing, Sales |

Regras: eventos são **imutáveis**, **versionados** (`.vN`), sempre carregam `occurredAt`, `actor`, `correlationId`. Nenhum evento carrega objeto de outro contexto por referência — sempre snapshot mínimo.

---

## 28. Versionamento & Compatibilidade N-1 (ADR-008)

Todo contrato (`PricingContext`, `PricingResult`, `PricingExplanation`, `TaxQuote`, `PricePolicy`, `CostComposition`, todo `*.Event`) traz um campo `version` obrigatório no formato `dominio/N`.

Regras:
- **Motor deve aceitar N e N-1** por, no mínimo, um ciclo de release.
- **Downgrade** entre versões conhecidas é responsabilidade do motor (adapter interno).
- **Nunca** remover campo obrigatório sem major bump.
- `engineVersion`, `calculationVersion`, `policyVersion` viajam sempre no `PricingResult` — permitem re-execução histórica.
- Mudanças de fórmula matemática exigem novo `calculationVersion` mesmo sem novo `engineVersion`.

---

## 29. Auditoria & Warnings (ADR-011)

Toda decisão relevante gera trilha reproduzível:

```
PricingDecision.v1 {
  decisionId, requestId, explainId
  companyId, productId, actor
  contextSnapshotRef       // hash + storage key do PricingContext usado
  resultSnapshotRef        // hash + storage key do PricingResult retornado
  engineVersion, calculationVersion, policyVersion, taxEngineVersion?
  occurredAt
  outcome                  // 'recommended' | 'applied' | 'rejected'
  warnings []
}
```

Vocabulário de warnings (fechado, versionado):

`COST_STALE`, `COST_MISSING`, `INSUFFICIENT_COST_DATA`, `TAX_QUOTE_MISSING`, `TAX_QUOTE_EXPIRED`, `TABLED_PRICE_BELOW_FLOOR`, `MARGIN_BELOW_MIN`, `MARGIN_BELOW_IDEAL`, `NON_LINEAR_CHANNEL_RULE_IGNORED`, `PRICE_LIST_FALLBACK_APPLIED`, `POLICY_CONTRADICTION`, `PSYCHOLOGICAL_ROUNDING_INFLATED_MARGIN`.

Retenção mínima: 5 anos para `PricingDecision` de vendas concretizadas (aderência a auditoria fiscal).

---

## 30. Parecer final — Sprint A0.1

**Classificação: 🟢 ARQUITETURA CONGELADA.**

Todos os 12 ajustes solicitados foram incorporados:

| # | Ajuste | Seção | ADR |
|---|---|---|---|
| 1 | PriceList (dois modos) | §23 | ADR-003 |
| 2 | Tax Engine separado | §19 | ADR-002 |
| 3 | Channel movido p/ Sales | §20 | ADR-006 |
| 4 | API reduzida (`compute`+`explain`) | §18 | ADR-001 |
| 5 | Estratégias ortogonais (Margin/Behavior/Rounding) | §22 | ADR-001 |
| 6 | Eventos de domínio | §27 | ADR-007 |
| 7 | `PricingContext.v1` congelado | §21 | ADR-004 |
| 8 | `PricingResult.v1` expandido | §24 | ADR-005, ADR-008 |
| 9 | `explain()` documentado | §25 | ADR-005, ADR-009 |
| 10 | Versionamento & N-1 | §28 | ADR-008 |
| 11 | Auditoria reproduzível | §29 | ADR-011 (registrada em ADR-008/010) |
| 12 | Bounded Contexts revisitados | §17 | ADR-006, ADR-010 |

**Critérios de freeze:**
- ✅ Sem ambiguidade nos contratos (v1 explícita, campos tipados).
- ✅ Sem conflito de responsabilidade (Pricing ↛ Tax ↛ Sales isolados).
- ✅ Responsabilidades isoladas por Bounded Context (§17).
- ✅ Preparada para crescimento (versionamento N-1, PriceList, ortogonalidade, eventos).

**Riscos remanescentes (aceitos, monitorar):**
1. **Custo de disciplina.** Ortogonalidade só funciona se ninguém reintroduzir "presets monolíticos". Mitigação: lint arquitetural + review bloqueante.
2. **`explain()` como contrato de UX.** Se Bella IA depender de wording, mudanças de narrativa quebram experiência. Mitigação: separar `summary` (livre) de `steps` (contrato estável).
3. **Sincronização Tax↔Pricing.** `TaxQuote` expira; venda longa (orçamento → aprovação) pode usar cotação stale. Mitigação: warning + re-cotação obrigatória em `PriceApplied`.
4. **Eventos sem broker real na Fase 1.** Contratos existem, entrega será in-process. Mitigação: aceitar; ADR-007 define migração para fila quando necessário.

**Próximo passo autorizado:** iniciar Fase 1 (implementação do motor v1 + Company Policy) obedecendo estritamente §17–§29 e os 10 ADRs.

