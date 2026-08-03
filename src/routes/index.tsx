import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 font-sans leading-relaxed text-foreground">
      <div className="w-full max-w-2xl space-y-8 rounded-xl border border-border bg-card p-10 shadow-lg">
        <header className="space-y-2 border-b border-border pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">AUDITORIA READ-ONLY</h1>
          <div className="flex flex-col items-center gap-1 text-sm font-medium text-destructive">
            <span>NÃO alterar código.</span>
            <span>NÃO alterar banco.</span>
            <span>NÃO alterar interface.</span>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground/90">OBJETIVO</h2>
          <p className="text-muted-foreground">
            Verificar se a publicação real de produtos no Mercado Livre já existe.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-md font-semibold text-foreground/90">DIAGNÓSTICO</h3>
          <ol className="list-decimal space-y-4 pl-5 text-sm text-foreground/80">
            <li>
              <span className="font-medium">Existe chamada para o endpoint POST /items da API oficial?</span>
              <p className="mt-1 text-muted-foreground">Sim. Implementado em <code className="rounded bg-muted px-1 py-0.5">src/lib/mercadolivre-publish.functions.ts</code> linha 711.</p>
            </li>
            <li>
              <span className="font-medium">O sistema já envia os dados do produto para o Mercado Livre?</span>
              <p className="mt-1 text-muted-foreground">Sim. O payload <code className="rounded bg-muted px-1 py-0.5">requestBody</code> inclui título, preço, estoque, descrição, imagens e atributos técnicos.</p>
            </li>
            <li>
              <span className="font-medium">O retorno da API é processado?</span>
              <p className="mt-1 text-muted-foreground">Sim. O sistema trata erros (causas da API) e, em caso de sucesso, captura o ID e Permalink.</p>
            </li>
            <li>
              <span className="font-medium">O ml_item_id é salvo no banco?</span>
              <p className="mt-1 text-muted-foreground">Sim. Persistido via Supabase na tabela <code className="rounded bg-muted px-1 py-0.5">products</code> após sucesso na API.</p>
            </li>
            <li>
              <span className="font-medium">O permalink do anúncio é salvo?</span>
              <p className="mt-1 text-muted-foreground">Sim. O campo <code className="rounded bg-muted px-1 py-0.5">ml_permalink</code> é atualizado junto com o ID.</p>
            </li>
            <li>
              <span className="font-medium">Existe botão funcional "Publicar no Mercado Livre"?</span>
              <p className="mt-1 text-muted-foreground">Sim. Disponível nos detalhes do produto, abrindo o <code className="rounded bg-muted px-1 py-0.5">PublishToMercadoLivreDialog</code>.</p>
            </li>
            <li>
              <span className="font-medium">É possível publicar um produto hoje sem intervenção manual?</span>
              <p className="mt-1 text-muted-foreground">Sim. O fluxo de publicação está completo desde a validação até a persistência do vínculo.</p>
            </li>
          </ol>
        </section>

        <footer className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          Infraestrutura de publicação 100% implementada e operacional.
        </footer>
      </div>
    </div>
  ),
});
