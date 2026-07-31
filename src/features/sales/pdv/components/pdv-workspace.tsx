import type { ReactNode } from "react";
import { PDV_LAYOUT } from "../lib/layout";

type Props = {
  /** Barra de operação (busca, leitor, status, número da venda). */
  operationBar: ReactNode;
  /** Área do carrinho — maior parte da tela, com rolagem própria. */
  cart: ReactNode;
  /** Painel lateral fixo (cliente, totais, pagamento, recibo). */
  panel: ReactNode;
};

/**
 * PDVWorkspace — shell de layout do PDV (Sprint 2.9).
 *
 * Puramente estrutural: recebe as áreas por composição, sem conhecer nenhum
 * hook, serviço ou regra. Facilita o rollback e a futura segunda tela.
 */
export function PDVWorkspace({ operationBar, cart, panel }: Props) {
  return (
    <div className={PDV_LAYOUT.shell}>
      {operationBar}
      <div className={PDV_LAYOUT.grid}>
        <section
          aria-label="Carrinho da venda"
          className={PDV_LAYOUT.cartColumn}
        >
          {cart}
        </section>
        <aside
          aria-label="Painel da venda"
          data-testid="pdv-side-panel"
          className={PDV_LAYOUT.sidePanel}
        >
          {panel}
        </aside>
      </div>
    </div>
  );
}
