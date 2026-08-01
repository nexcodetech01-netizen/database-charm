import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BellaInventoryLink } from "./types";

export interface BellaInventoryActionsProps {
  links: readonly BellaInventoryLink[];
  className?: string;
  size?: "sm" | "xs";
}

/**
 * Botões de navegação da Bella Estoque.
 * Nenhum botão movimenta, ajusta ou recalcula estoque — apenas abre telas.
 */
export function BellaInventoryActions({
  links,
  className,
  size = "sm",
}: BellaInventoryActionsProps) {
  if (links.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {links.map((link) => (
        <Button
          key={`${link.id}-${link.href}`}
          asChild
          variant="outline"
          size="sm"
          className={cn("rounded-xl font-normal", size === "xs" && "h-7 px-2.5 text-xs")}
        >
          <a href={link.href} data-testid={`bella-inventory-link-${link.id}`}>
            {link.label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </Button>
      ))}
    </div>
  );
}
