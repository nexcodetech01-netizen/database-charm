import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 font-sans leading-relaxed text-foreground">
      <div className="w-full max-w-3xl space-y-8 rounded-xl border border-border bg-card p-10 shadow-lg">
        <header className="space-y-2 border-b border-border pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">AUDITORIA READ-ONLY</h1>
          <div className="flex flex-col items-center gap-1 text-sm font-medium text-destructive">
            <span>NÃO alterar código.</span>
            <span>NÃO alterar banco.</span>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground/90 text-center">OBJETIVO</h2>
          <p className="text-center text-muted-foreground">
            Descobrir por que a Data da Venda está sendo gravada como o dia anterior.
          </p>
        </section>

        <section className="space-y-6">
          <h3 className="text-md font-semibold text-foreground/90 border-l-4 border-primary pl-3">DIAGNÓSTICO TÉCNICO</h3>
          
          <div className="grid gap-6">
            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">1. A coluna "Data da venda" utiliza qual campo do banco?</span>
              <p className="text-sm text-muted-foreground">Utiliza o campo <code className="bg-muted px-1 rounded">sale_date</code> do tipo <code className="italic">date</code> (apenas YYYY-MM-DD).</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">2. Qual valor foi gravado para a venda PDV-20260803-152449?</span>
              <p className="text-sm text-muted-foreground">
                <code className="bg-muted px-1 rounded">sale_date</code>: 2026-08-03 | 
                <code className="bg-muted px-1 rounded">created_at</code>: 2026-08-03 18:26:27.638+00 (UTC).
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">3. O sistema utiliza UTC ou horário local (America/Sao_Paulo)?</span>
              <p className="text-sm text-muted-foreground">O banco armazena timestamps em UTC. A lógica de negócio e exibição utilizam America/Sao_Paulo (UTC-3).</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">4. Existe conversão de timezone no backend?</span>
              <p className="text-sm text-muted-foreground">Sim. O trigger <code className="bg-muted px-1 rounded">trg_set_sale_date_company_today</code> utiliza a RPC <code className="bg-muted px-1 rounded">company_today()</code> para garantir que a data seja a da empresa.</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">5. Existe conversão de timezone no frontend?</span>
              <p className="text-sm text-muted-foreground">Sim, via <code className="bg-muted px-1 rounded">src/lib/time/</code>. Porém, filtros em <code className="bg-muted px-1 rounded">vendas.tsx</code> usam <code className="bg-muted px-1 rounded">new Date()</code> puro, o que causa drift em fechamentos noturnos.</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">6. A Data do Pagamento utiliza qual campo?</span>
              <p className="text-sm text-muted-foreground">Utiliza o campo <code className="bg-muted px-1 rounded">paid_at</code> (timestamptz), que preserva a precisão do instante universal.</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">7. Por que a Data do Pagamento está correta e a Data da Venda não?</span>
              <p className="text-sm text-muted-foreground">
                <code className="bg-muted px-1 rounded">paid_at</code> é um timestamp completo. <code className="bg-muted px-1 rounded">sale_date</code> é truncado e, se o frontend enviar um "Hoje" calculado em UTC após as 21h, ele grava o dia seguinte (ou anterior no filtro).
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-bold text-foreground/80">8. Informar exatamente o arquivo responsável por gravar a Data da Venda.</span>
              <p className="text-sm text-muted-foreground">
                <code className="bg-muted px-1 rounded">src/features/sales/services/sales.service.ts</code> (linhas 562-567) decide se envia a data ou deixa o banco resolver.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-destructive">DIAGNÓSTICO FINAL</p>
          <p>
            O desvio ocorre pelo uso de <code className="bg-muted px-1 rounded">new Date().toISOString()</code> em filtros do frontend e componentes de data que não respeitam o fuso da empresa (UTC-3), gerando inconsistência em vendas realizadas entre 21:00 e 00:00.
          </p>
        </footer>
      </div>
    </div>
  ),
});
