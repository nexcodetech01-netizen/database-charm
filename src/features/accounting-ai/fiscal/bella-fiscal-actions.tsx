import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BellaFiscalLink } from "./types";

export interface BellaFiscalActionsProps {
  links: readonly BellaFiscalLink[];
  className?: string;
  size?: "sm" | "xs";
}

/**
 * Botões de navegação da Bella Fiscal.
 * Nenhum botão emite, cancela ou reprocessa nota — apenas abre telas.
 */
export function BellaFiscalActions({ links, className, size = "sm" }: BellaFiscalActionsProps) {
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
          <a href={link.href} data-testid={`bella-fiscal-link-${link.id}`}>
            {link.label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </Button>
      ))}
    </div>
  );
}
