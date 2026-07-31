import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const STEPS: { title: string; description: string }[] = [
  {
    title: "1. Abrir o caixa",
    description:
      "Antes de realizar vendas, informe apenas o dinheiro físico disponível para troco. Caso não exista dinheiro em caixa, mantenha R$ 0,00.",
  },
  {
    title: "2. Durante o expediente",
    description:
      "As vendas podem ser realizadas normalmente por Dinheiro, PIX ou Cartão. O sistema registra cada forma de pagamento automaticamente.",
  },
  {
    title: "3. Sangrias e suprimentos",
    description:
      "Sempre que retirar ou adicionar dinheiro físico ao caixa, registre a operação para manter o saldo correto.",
  },
  {
    title: "4. Fechar o caixa",
    description:
      "Ao final do expediente, conte apenas o dinheiro físico existente na gaveta e informe o valor em \"Dinheiro físico contado\".",
  },
  {
    title: "5. PIX e Cartão",
    description:
      "PIX e Cartão aparecem apenas no resumo das vendas. Eles não fazem parte da conferência do dinheiro físico.",
  },
];

export function CashHelpCard() {
  return (
    <Card className="border-dashed">
      <Accordion type="single" collapsible>
        <AccordionItem value="how-it-works" className="border-b-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Como funciona o caixa?
                </p>
                <p className="text-xs text-muted-foreground">
                  Um guia rápido do fluxo diário de abertura, vendas e fechamento.
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <ol className="space-y-4 border-l border-border pl-5">
              {STEPS.map((step) => (
                <li key={step.title} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {step.title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
