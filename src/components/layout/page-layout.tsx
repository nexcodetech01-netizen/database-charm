import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { PageHeader } from "./page-header";

/**
 * PageLayout — envelope visual único de todas as telas do NexOS.
 *
 * Padroniza:
 *  - largura máxima e centralização
 *  - espaçamento vertical entre blocos (header → kpis → toolbar → conteúdo)
 *  - breadcrumbs no topo (opt-out via `showBreadcrumb={false}`)
 *  - cabeçalho via {@link PageHeader}
 *  - slot opcional `aside` para painel lateral (detalhes / filtros persistentes)
 *
 * Não altera nenhuma regra de negócio: apenas compõe primitivos já existentes
 * para eliminar variações estruturais entre módulos.
 */
export interface PageLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  actions?: ReactNode;
  /** KPIs / cards de resumo, renderizados logo abaixo do header. */
  kpis?: ReactNode;
  /** Toolbar (busca + filtros + ações) — renderizada acima do conteúdo. */
  toolbar?: ReactNode;
  /** Painel lateral fixo (ex.: detalhes / filtros avançados). */
  aside?: ReactNode;
  /** Conteúdo principal da página. */
  children: ReactNode;
  showBreadcrumb?: boolean;
  className?: string;
  contentClassName?: string;
}

export function PageLayout({
  title,
  description,
  icon,
  meta,
  actions,
  kpis,
  toolbar,
  aside,
  children,
  showBreadcrumb = true,
  className,
  contentClassName,
}: PageLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6", className)}>
      {showBreadcrumb ? <BreadcrumbNav /> : null}
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        meta={meta}
        actions={actions}
      />
      {kpis}
      {toolbar}
      {aside ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={cn("min-w-0 space-y-4", contentClassName)}>{children}</div>
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">{aside}</aside>
        </div>
      ) : (
        <div className={cn("space-y-4", contentClassName)}>{children}</div>
      )}
    </div>
  );
}
