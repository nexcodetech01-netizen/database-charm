import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { listReviews, moderateReview } from "@/features/catalog/lib/review-moderation.functions";

export const Route = createFileRoute("/_authenticated/produtos_/avaliacoes")({
  component: ReviewsModerationPage,
});

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} className={n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />
      ))}
    </div>
  );
}

function ReviewsModerationPage() {
  const { companyId } = useAuth();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const queryClient = useQueryClient();

  const listReviewsFn = useServerFn(listReviews);
  const moderateReviewFn = useServerFn(moderateReview);

  const queryKey = ["reviews-moderation", companyId, tab];
  const { data: reviews, isLoading } = useQuery({
    queryKey,
    queryFn: () => listReviewsFn({ data: { companyId: companyId!, status: tab } }),
    enabled: !!companyId,
  });

  const moderateMutation = useMutation({
    mutationFn: (vars: { reviewId: string; decision: "approved" | "rejected" }) =>
      moderateReviewFn({ data: { reviewId: vars.reviewId, companyId: companyId!, decision: vars.decision } }),
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(vars.decision === "approved" ? "Avaliação aprovada — já está visível no catálogo." : "Avaliação rejeitada.");
        void queryClient.invalidateQueries({ queryKey: ["reviews-moderation", companyId] });
      } else {
        toast.error(result.error || "Não foi possível atualizar a avaliação.");
      }
    },
  });

  return (
    <div className="space-y-6 p-6">
      <BreadcrumbNav items={[{ label: "Produtos", href: "/produtos" }, { label: "Avaliações" }]} />
      <PageHeader
        title="Avaliações de produtos"
        description="Revise as avaliações enviadas pelos clientes no catálogo antes de aparecerem publicamente."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !reviews || reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma avaliação aqui"
          description={
            tab === "pending"
              ? "Quando um cliente avaliar um produto no catálogo, ela aparece aqui pra você revisar."
              : "Nada por enquanto."
          }
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{r.customer_name}</span>
                    <StarRow value={r.rating} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.products?.name ?? "Produto"} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                </div>
                {tab === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-emerald-600 hover:text-emerald-700"
                      disabled={moderateMutation.isPending}
                      onClick={() => moderateMutation.mutate({ reviewId: r.id, decision: "approved" })}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={moderateMutation.isPending}
                      onClick={() => moderateMutation.mutate({ reviewId: r.id, decision: "rejected" })}
                    >
                      <X className="h-3.5 w-3.5" />
                      Rejeitar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
