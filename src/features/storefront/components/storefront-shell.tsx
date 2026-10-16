import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { brandStyle, type StoreBranding } from "../lib/brand";

/**
 * Moldura comum das telas que o cliente da loja vê (rastreio, fidelidade).
 * Mesmo visual do catálogo: claro/escuro conforme o aparelho do cliente,
 * com a logo, o nome e a cor principal da loja.
 */
export function StorefrontShell({
  branding,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  branding?: Partial<StoreBranding> | null;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const name = branding?.name ?? null;
  const logoUrl = branding?.logoUrl ?? null;
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={brandStyle(branding?.primaryColor)}
    >
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10">
        <header className="mb-8 text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name ?? "Logo da loja"}
              className="mx-auto h-16 w-16 rounded-full border border-border bg-white object-contain p-1"
            />
          ) : (
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
          {name ? (
            <p className="mt-3 text-sm font-semibold tracking-wide text-foreground">{name}</p>
          ) : null}
          <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        </header>

        <main className="flex-1">{children}</main>

        {name ? (
          <footer className="mt-10 text-center text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} {name}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
