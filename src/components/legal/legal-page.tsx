import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalPage({ title, updatedAt, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/40">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            NexOS
          </Link>
          <span className="text-xs text-muted-foreground">nexos.nexxcode.com.br</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>

        <article className="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_strong]:text-foreground">
          {children}
        </article>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} NexOS · NexxCode</span>
          <nav className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>
            <Link to="/terms" className="hover:text-foreground">Termos</Link>
            <Link to="/data-deletion" className="hover:text-foreground">Exclusão de dados</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
