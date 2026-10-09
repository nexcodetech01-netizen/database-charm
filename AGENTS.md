<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- O PDV relaciona preços de checkout à posição de `sale_items`, porque produtos repetidos e itens avulsos não têm identidade única por produto.
- O refresh token do Mercado Livre nunca é repetido automaticamente, porque é de uso único e uma resposta perdida pode já tê-lo consumido.
- Os totais à vista e no cartão do PDV usam as funções compartilhadas de `card-price.ts`, para manter a tela alinhada à fórmula SQL por linha.
- Violações do índice único de código de barras devem virar mensagens amigáveis; o índice nunca deve ser removido ou afrouxado.
- Valores que representam ausência de código de barras passam pelo normalizador compartilhado antes de deduplicação e persistência, preservando códigos reais e NULL legado.
- O preço no cartão usa centavos inteiros e taxa em pontos-base, para evitar divergência de centavos com o cálculo numeric do banco.
- A busca de produtos ignora `SEM GTIN` no campo de código de barras, para não retornar produtos sem código em consultas por esse marcador.
- A pesquisa autenticada de produtos usa o cliente do usuário e checagem de empresa no SQL, pois o cliente administrativo contornaria o isolamento multiempresa.

- Keep audit readers, query hooks, and reusable history views in `src/features/audit`, using the browser Supabase client and existing audit authorization RPC; this preserves RLS and avoids duplicating database schema.
- Mount record audit history through the shared audit feature, and guard the authenticated history page with the existing audit permission; this keeps screen integrations consistent with current authorization.
- Keep statement parsing, matching and analysis as pure utilities in the bank-reconciliation feature, with PDF text extraction loaded in the browser; this separates review logic from persistence and browser-only PDF processing.
- Keep bank reconciliation persistence in its browser-client service and reuse financeService for launches; this preserves existing RLS and settlement behavior without duplicating schema or financial workflows.
- Export the bank reconciliation dialog through its feature entry point and keep statement review state inside the dialog; this allows finance screens to mount the workflow without duplicating review logic.
