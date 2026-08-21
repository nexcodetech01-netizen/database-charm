import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Truck, MapPin, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getShipmentByTrackingCode } from "@/features/shipping/lib/shipment-tracking.functions";

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
    <div className="min-h-screen bg-[#161310] text-white">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 text-center">
          <Package className="mx-auto h-8 w-8 text-[#E5A855]" />
          <h1 className="mt-3 text-lg font-bold uppercase tracking-widest text-[#E5A855]">
            Rastreio do pedido
          </h1>
        </div>

        {isLoading ? (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-6 text-center text-sm text-white/60">
              Buscando informações do envio…
            </CardContent>
          </Card>
        ) : !shipment ? (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-white/70">
                Não encontramos nenhum envio com o código{" "}
                <span className="font-mono text-white">{trackingCode}</span>.
              </p>
              <p className="mt-2 text-xs text-white/50">
                Confira se o código foi digitado certinho, ou fale com quem vendeu pra você.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-[#E5A855]/15 p-2">
                    <Truck className="h-5 w-5 text-[#E5A855]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {STATUS_LABEL[shipment.status] ?? shipment.status}
                    </p>
                    <p className="text-xs text-white/50">
                      {shipment.carrier ?? "Correios"}
                      {shipment.service_name ? ` — ${shipment.service_name}` : ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-black/20 p-3">
                  <p className="text-xs text-white/50">Código de rastreio</p>
                  <p className="font-mono text-sm font-semibold">{shipment.tracking_code}</p>
                </div>

                {(shipment.recipient_city || shipment.recipient_state) && (
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <MapPin className="h-4 w-4 text-white/40" />
                    Destino: {[shipment.recipient_city, shipment.recipient_state].filter(Boolean).join(" / ")}
                  </div>
                )}

                {shipment.estimated_delivery_days && (
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCircle2 className="h-4 w-4 text-white/40" />
                    Prazo estimado: até {shipment.estimated_delivery_days} dias úteis
                  </div>
                )}
              </CardContent>
            </Card>

            <a href={correiosUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2 bg-[#E5A855] text-black hover:bg-[#E5A855]/90">
                Ver rastreio detalhado nos Correios
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
            <p className="text-center text-xs text-white/40">
              Status ao vivo (saiu pra entrega, chegou na sua cidade, etc.) é sempre mais
              atualizado direto na página oficial dos Correios.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
