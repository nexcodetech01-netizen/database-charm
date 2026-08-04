import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, ShoppingBag, ArrowRight, RefreshCw, CheckCircle, Package } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExternalOrders, importExternalOrder } from "@/lib/external-orders.functions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/importacoes/mercado-livre")({
  component: MercadoLivreOrdersPage,
});

function MercadoLivreOrdersPage() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["external-orders", "mercadolivre"],
    queryFn: () => getExternalOrders({ marketplace: "mercadolivre", status: "pending" }),
  });

  const importMutation = useMutation({
    mutationFn: (orderId: string) => importExternalOrder({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Pedido importado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
    },
    onError: (error: any) => {
      toast.error(`Falha ao importar: ${error.message}`);
    },
  });

  return (
    <PageLayout
      icon={ShoppingBag}
      title="Pedidos Mercado Livre"
      description="Gerencie e importe pedidos recebidos do Mercado Livre."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>ID Pedido</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status ML</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              ) : orders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum pedido pendente para importação.
                  </TableCell>
                </TableRow>
              ) : (
                orders?.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.external_order_id}
                    </TableCell>
                    <TableCell>
                      {order.payload.buyer?.nickname || "Não identificado"}
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(order.payload.total_amount || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.payload.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => importMutation.mutate(order.id)}
                        disabled={importMutation.isPending}
                      >
                        {importMutation.isPending ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="mr-2 h-4 w-4" />
                        )}
                        Importar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
}
