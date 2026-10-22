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
- Bella notification server functions require login and company access; server-generated events persist through the persister injected in `src/server.ts`, because the event registry also runs in the browser and must not import server-only code.
- Asaas API keys (`bella_pay_config.api_key_*`) are read and written only on the server via `src/features/bella-pay/lib/credentials.server.ts` (service role after a company-access check); the browser selects explicit non-key columns and shows only a masked status, because the database revokes those columns from `authenticated`.
- Sale numbers are assigned by the database (`trg_zz_assign_sale_number` → `next_sale_number`, format `VD-AAAAMMDD-0001` per company/day); browser-generated numbers are only provisional placeholders, so always display the number returned by the insert. Retries are deduplicated by `sales.client_request_id` (unique per company), never by number + total.
- New sales are written through the `create_sale_with_items` RPC (SECURITY INVOKER, one transaction for sale + items, honors `client_request_id`); the direct insert path in `salesService.create` remains only as a fallback when the function is missing.
- Stock realtime (`useInventoryRealtime`) listens only to `products` changes, patches the PDV catalog in memory from the event payload, and refreshes other stock caches only when active (inactive ones are removed); never reintroduce `refetchType: "all"` or a full PDV catalog refetch per sale, because every terminal would reload up to 2,000 products on each sale.
