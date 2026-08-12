import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  ShoppingBag,
  ShoppingCart,
  Package,
  Chrome,
  Facebook,
  Instagram,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MercadoLivreConnectDialog } from "@/features/integrations/mercadolivre/mercadolivre-connect-dialog";
import { getMercadoLivreIntegration } from "@/lib/mercadolivre.functions";

export const MERCADOLIVRE_INTEGRATION_QUERY_KEY = ["mercadolivre-integration"] as const;

type IntegrationStatus = "connected" | "available";

interface IntegrationCard {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Ícone secundário opcional (ex.: Meta = Facebook + Instagram). */
  secondaryIcon?: LucideIcon;
  status: IntegrationStatus;
  /** Rota interna para gerenciar a integração (quando existe página dedicada). */
  manageTo?: string;
  /** Ação customizada (ex.: abrir modal de configuração). */
  action?: "mercadolivre";
}


const CARDS: IntegrationCard[] = [
  {
    title: "Asaas",
    description: "Gateway de PIX, cartão e boleto usado pelo Bella Pay.",
    icon: CreditCard,
    status: "available",
    manageTo: "/bella-pay",
  },
  {
    title: "Meta",
    description: "Facebook, Instagram e Commerce Manager em uma só integração.",
    icon: Facebook,
    secondaryIcon: Instagram,
    status: "available",
    manageTo: "/configuracoes/integracoes/meta",
  },
  {
    title: "Mercado Livre",
    description: "Sincronize anúncios, pedidos e estoque.",
    icon: ShoppingBag,
    status: "available",
    action: "mercadolivre",
  },
  {
    title: "Shopee",
    description: "Publique produtos e gerencie pedidos da Shopee.",
    icon: ShoppingCart,
    status: "available",
  },
  {
    title: "Amazon",
    description: "Sincronize catálogo e pedidos da Amazon.",
    icon: Package,
    status: "available",
  },
  {
    title: "Google",
    description: "Google Business, Ads e Merchant Center.",
    icon: Chrome,
    status: "available",
  },
];

const STATUS: Record<IntegrationStatus, { label: string; className: string }> = {
  connected: {
    label: "Conectado",
    className: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  },
  available: {
    label: "Não conectado",
    className: "border-muted-foreground/30 text-muted-foreground",
  },
};

export function IntegracoesSection() {
  const [mlOpen, setMlOpen] = useState(false);
  const queryClient = useQueryClient();
  const getMlIntegration = useServerFn(getMercadoLivreIntegration);
  const { company } = (Link as any).useRouteContext?.() || { company: { id: "default" } }; // Fallback for context if needed, but usually available in parent

  const { data: bellaPayConfig } = useQuery({
    queryKey: ["bella-pay", "config", company?.id],
    queryFn: () => bellaPayConfigFn({ data: { companyId: company?.id } }),
    enabled: !!company?.id,
  });

  const { data: mlIntegration } = useQuery({
    queryKey: MERCADOLIVRE_INTEGRATION_QUERY_KEY,
    queryFn: () => getMlIntegration(),
    staleTime: 30_000,
  });
  const mlConnected = mlIntegration?.connected ?? false;
  const asaasConnected = !!bellaPayConfig?.api_key_production || !!bellaPayConfig?.api_key_sandbox;

  const handleMlStatusChange = () => {
    void queryClient.invalidateQueries({ queryKey: MERCADOLIVRE_INTEGRATION_QUERY_KEY });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const SecondaryIcon = card.secondaryIcon;
          const effectiveStatus: IntegrationStatus =
            card.action === "mercadolivre" && mlConnected ? "connected" : card.status;
          const status = STATUS[effectiveStatus];
          const label = effectiveStatus === "connected" ? "Gerenciar" : "Configurar";
          const variant = effectiveStatus === "connected" ? "outline" : "default";
          return (
            <Card key={card.title} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-start gap-3">
                  <div className="relative grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                    {SecondaryIcon ? (
                      <SecondaryIcon className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-background p-0.5 text-primary" />
                    ) : null}
                  </div>
                  <div>
                    <CardTitle className="text-sm">{card.title}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-2 pt-2">
                {card.manageTo ? (
                  <Button asChild size="sm" variant={variant}>
                    <Link to={card.manageTo}>
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                      {label}
                    </Link>
                  </Button>
                ) : card.action === "mercadolivre" ? (
                  <Button size="sm" variant={variant} onClick={() => setMlOpen(true)}>
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    {label}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={variant}
                    onClick={() =>
                      toast.info(
                        effectiveStatus === "connected"
                          ? `Abrindo configuração de ${card.title}…`
                          : `Conecte sua conta ${card.title} para começar a sincronizar.`,
                      )
                    }
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    {label}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <MercadoLivreConnectDialog
        open={mlOpen}
        onOpenChange={setMlOpen}
        onStatusChange={handleMlStatusChange}
      />
    </>
  );
}
