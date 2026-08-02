/**
 * AppliedMarginPolicyCard
 * =======================
 * Card enxuto para a tela de detalhes do produto — mostra qual Política Comercial
 * está sendo aplicada (categoria ou personalizada), com margem alvo, margem
 * mínima e desconto padrão da categoria.
 *
 * Não faz cálculo, apenas leitura.
 */
import { Link } from "@tanstack/react-router";
import { Layers, Percent, ShieldCheck, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import { resolveMarginPolicy } from "@/features/pricing/official/margin-policy";

interface Props {
  categoryName: string | null;
  categoryTargetMarginPct: number | null;
  categoryMinMarginPct: number | null;
  categoryDefaultDiscountPct?: number | null;
  productMarginPct: number;
  useCategoryMargin: boolean;
  /** Margem máxima da categoria (%), quando configurada. */
  categoryMaxMarginPct?: number | null;
  /** "Utilizar política automática" da categoria. */
  categoryAutoPolicy?: boolean | null;
}

export function AppliedMarginPolicyCard({
  categoryName,
  categoryTargetMarginPct,
  categoryMinMarginPct,
  categoryDefaultDiscountPct,
  productMarginPct,
  useCategoryMargin,
  categoryMaxMarginPct,
  categoryAutoPolicy,
}: Props) {
  const hasCategoryTarget =
    categoryTargetMarginPct != null && Number.isFinite(categoryTargetMarginPct);
  const hasCategoryMin = categoryMinMarginPct != null && Number.isFinite(categoryMinMarginPct);
  const hasCategoryDiscount =
    categoryDefaultDiscountPct != null && Number.isFinite(categoryDefaultDiscountPct);
  // AUDITORIA: a margem utilizada e sua ORIGEM vêm do resolvedor oficial.
  const resolution = resolveMarginPolicy({
    product: { marginPct: productMarginPct, useCategoryMargin },
    category: {
      targetPct: categoryTargetMarginPct,
      minPct: categoryMinMarginPct,
      maxPct: categoryMaxMarginPct,
      autoPolicy: categoryAutoPolicy,
    },
    fallbackTargetPct: productMarginPct,
  });
  const originIsCategory = resolution.origin === "category" && hasCategoryTarget;
  const policyValue = resolution.marginPct;
  const policyLabel = `Margem utilizada ${formatPercent(policyValue)}% — origem: ${
    originIsCategory ? "Categoria" : "Produto"
  }`;
  const Icon = originIsCategory ? Layers : User;

  return (
    <Card className="border-primary/20">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Política Comercial aplicada
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Categoria:</span>
              <span className="font-medium text-foreground">{categoryName ?? "Sem categoria"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <Percent className="h-3 w-3" />
                Margem de Lucro do produto: {formatPercent(productMarginPct)}%
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Icon className="h-3 w-3" />
                {policyLabel}
              </Badge>
              {hasCategoryMin ? (
                <>
                  <span className="text-muted-foreground">Mínima:</span>
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {formatPercent(categoryMinMarginPct as number)}%
                  </Badge>
                </>
              ) : null}
              {hasCategoryDiscount ? (
                <>
                  <span className="text-muted-foreground">Desconto padrão:</span>
                  <Badge variant="outline" className="gap-1">
                    <Percent className="h-3 w-3" />
                    {formatPercent(categoryDefaultDiscountPct as number)}%
                  </Badge>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/configuracoes/precificacao">Ajustar política</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
