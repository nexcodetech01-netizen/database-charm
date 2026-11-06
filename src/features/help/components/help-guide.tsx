import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { GUIDE_SECTIONS, filterGuide } from "../guide-content";

const md = {
  p: (p: React.ComponentProps<"p">) => <p className="my-2 leading-relaxed" {...p} />,
  ul: (p: React.ComponentProps<"ul">) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: React.ComponentProps<"ol">) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
  strong: (p: React.ComponentProps<"strong">) => <strong className="font-semibold text-foreground" {...p} />,
  table: (p: React.ComponentProps<"table">) => (
    <div className="my-3 overflow-x-auto rounded-md border">
      <table className="w-full text-sm" {...p} />
    </div>
  ),
  th: (p: React.ComponentProps<"th">) => (
    <th className="border-b bg-muted/50 px-3 py-2 text-left font-medium" {...p} />
  ),
  td: (p: React.ComponentProps<"td">) => <td className="border-b px-3 py-2 align-top" {...p} />,
};

/** Guia de uso: sumário, busca e uma seção por tema. */
export function HelpGuide() {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => filterGuide(GUIDE_SECTIONS, query), [query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no guia: troca, etiqueta, caixa, crediário…"
          className="pl-9"
          aria-label="Buscar no guia"
        />
      </div>

      {!query.trim() ? (
        <nav className="flex flex-wrap gap-2" aria-label="Sumário">
          {GUIDE_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
            >
              {s.title}
            </a>
          ))}
        </nav>
      ) : null}

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada encontrado para "{query}". Tente outra palavra.
        </p>
      ) : (
        sections.map((s) => (
          <Card key={s.id} id={s.id} className="scroll-mt-20">
            <CardContent className="p-6 text-sm text-muted-foreground">
              <h2 className="mb-2 text-lg font-semibold text-foreground">{s.title}</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {s.body}
              </ReactMarkdown>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
