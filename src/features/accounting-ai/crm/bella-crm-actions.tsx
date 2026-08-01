import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BellaCrmLink } from "./types";

export interface BellaCrmActionsProps {
  links: readonly BellaCrmLink[];
  className?: string;
  size?: "sm" | "xs";
}

/**
 * Botões de navegação da Bella CRM.
 * Nenhum botão cria, altera ou remove cliente — apenas abre telas.
 */
export function BellaCrmActions({ links, className, size = "sm" }: BellaCrmActionsProps) {
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
          <a href={link.href} data-testid={`bella-crm-link-${link.id}`}>
            {link.label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </Button>
      ))}
    </div>
  );
}
