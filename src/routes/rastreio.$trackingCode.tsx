import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Truck, MapPin, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getShipmentByTrackingCode } from "@/features/shipping/lib/shipment-tracking.functions";
import { StorefrontShell } from "@/features/storefront/components/storefront-shell";

export const Route = createFileRoute("/rastreio/$trackingCode")({
  component: RastreioPage,
});

/**
 * Status simplificado que temos hoje: sabemos que a etiqueta foi
 * criada (o momento em que salvamos o registro). Rastreio detalhado
 * em tempo real (saiu pra entrega, chegou no destino, etc.) exigiria
 * integrar com a API de rastreio da SuperFrete/Correios separadamente
 * — por enquanto, direcionamos pro rastreio oficial dos Correios pra
 * isso, que já é preciso e atualizado.
 */
const STATUS_LABEL: Record<string, string> = {
  label_created: "Etiqueta gerada — aguardando postagem",
  posted: "Postado",
  in_transit: "Em trânsito",
  delivered: "Entregue",
};

function RastreioPage() {
  const { trackingCode } = Route.useParams();
  const getShipmentFn = useServerFn(getShipmentByTrackingCode);

  const { data: shipment, isLoading } = useQuery({
    queryKey: ["public-shipment-tracking", trackingCode],
    queryFn: () => getShipmentFn({ data: { trackingCode } }),
    enabled: !!trackingCode,
  });

  const correiosUrl = `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(trackingCode)}`;

  return (
    <StorefrontShell
      branding={shipment?.store ?? null}
      icon={Package}
      title="Rastreio do pedido"
    >
      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Buscando informações do envio…
          </CardContent>
        </Card>
      ) : !shipment ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não encontramos nenhum envio com o código{" "}
              <span className="font-mono text-foreground">{trackingCode}</span>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Confira se o código foi digitado certinho, ou fale com quem vendeu pra você.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {STATUS_LABEL[shipment.status] ?? shipment.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shipment.carrier ?? "Correios"}
                    {shipment.service_name ? ` — ${shipment.service_name}` : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Código de rastreio</p>
                <p className="font-mono text-sm font-semibold">{shipment.tracking_code}</p>
              </div>

              {(shipment.recipient_city || shipment.recipient_state) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Destino:{" "}
                  {[shipment.recipient_city, shipment.recipient_state].filter(Boolean).join(" / ")}
                </div>
              )}

              {shipment.estimated_delivery_days && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Prazo estimado: até {shipment.estimated_delivery_days} dias úteis
                </div>
              )}
            </CardContent>
          </Card>

          <Button asChild className="w-full gap-2">
            <a href={correiosUrl} target="_blank" rel="noopener noreferrer">
              Ver rastreio detalhado nos Correios
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Status ao vivo (saiu pra entrega, chegou na sua cidade, etc.) é sempre mais
            atualizado direto na página oficial dos Correios.
          </p>
        </div>
      )}
    </StorefrontShell>
  );
}
