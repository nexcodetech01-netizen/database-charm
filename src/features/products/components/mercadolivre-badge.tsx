import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  mlItemId: string | null | undefined;
  permalink: string | null | undefined;
  compact?: boolean;
}

export function MercadoLivreBadge({ mlItemId, permalink, compact }: Props) {
  if (!mlItemId) return null;
  const body = (
    <Badge
      variant="secondary"
      className="gap-1 border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
    >
      <span aria-hidden>🛒</span>
      {compact ? "ML" : "Publicado no ML"}
      {permalink ? <ExternalLink className="h-3 w-3" /> : null}
    </Badge>
  );
  if (!permalink) return body;
  return (
    <a
      href={permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex"
      title={`Ver anúncio ${mlItemId}`}
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </a>
  );
}
