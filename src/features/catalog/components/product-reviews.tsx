import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { submitProductReview, getApprovedReviews } from "@/features/catalog/lib/product-reviews.functions";

function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          className="p-0.5"
        >
          <Star
            size={26}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId, companyId }: { productId: string; companyId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const getApprovedReviewsFn = useServerFn(getApprovedReviews);
  const submitProductReviewFn = useServerFn(submitProductReview);

  const queryKey = ["product-reviews", productId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getApprovedReviewsFn({ data: { productId } }),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitProductReviewFn({
        data: { productId, companyId, customerName: name.trim(), rating, comment: comment.trim() || undefined },
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Avaliação enviada! Ela vai aparecer aqui assim que for revisada.");
        setDialogOpen(false);
        setName("");
        setRating(0);
        setComment("");
      } else {
        toast.error(result.error || "Não foi possível enviar sua avaliação.");
      }
    },
    onError: () => {
      toast.error("Não foi possível enviar sua avaliação. Tenta de novo.");
    },
  });

  function handleSubmit() {
    if (name.trim().length < 2) {
      toast.error("Digite seu nome.");
      return;
    }
    if (rating < 1) {
      toast.error("Escolhe quantas estrelas você daria.");
      return;
    }
    submitMutation.mutate();
  }

  const reviews = data?.reviews ?? [];
  const average = data?.average ?? null;
  const count = data?.count ?? 0;

  return (
    <div className="mt-8 border-t pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Avaliações</h3>
          {average !== null && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <StarRow value={average} />
              <span>
                {average.toFixed(1)} · {count} avaliaç{count === 1 ? "ão" : "ões"}
              </span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          Avaliar produto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando avaliações…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma avaliação ainda — seja a primeira pessoa a avaliar!
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.customer_name}</span>
                  <StarRow value={r.rating} size={14} />
                </div>
                {r.comment && <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sua nota</Label>
              <div className="mt-1">
                <StarPicker value={rating} onChange={setRating} />
              </div>
            </div>
            <div>
              <Label htmlFor="review-name">Seu nome</Label>
              <Input id="review-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?" />
            </div>
            <div>
              <Label htmlFor="review-comment">Comentário (opcional)</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conta como foi sua experiência com o produto"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sua avaliação passa por uma revisão rápida antes de aparecer pra outras pessoas.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="w-full">
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Enviar avaliação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
