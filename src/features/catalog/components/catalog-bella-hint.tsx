import { BellaInlineSuggestion } from "@/features/bella-ai";
import { useUncatalogedCount } from "../hooks/use-catalog";

interface Props {
  companyId: string;
  onOpen: () => void;
}

export function CatalogBellaHint({ companyId, onOpen }: Props) {
  const { data: count = 0 } = useUncatalogedCount(companyId);
  if (count === 0) return null;
  return (
    <BellaInlineSuggestion
      tone="info"
      title="Produtos sem coleção"
      message={`${count} produto${count === 1 ? "" : "s"} ativo${count === 1 ? "" : "s"} ainda não está${count === 1 ? "" : "ão"} em nenhuma coleção do catálogo.`}
      action={{ label: "Abrir Catálogo", onClick: onOpen }}
      contextPrompt={`Tenho ${count} produtos sem coleção no catálogo. Sugira agrupamentos.`}
    />
  );
}
