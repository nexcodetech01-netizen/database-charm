import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/compras_/$purchaseId/")({
  component: () => {
    // Redireciona para o componente de detalhes que agora está isolado
    // Ou simplesmente renderiza o componente de detalhes aqui.
    // Como queremos manter a estrutura limpa, vamos importar o componente se possível
    // ou apenas mover a lógica de detalhes para cá.
    return <PurchaseDetailsWrapper />;
  },
});

import { PurchaseDetails } from "./compras_.$purchaseId";

function PurchaseDetailsWrapper() {
  return <PurchaseDetails />;
}
