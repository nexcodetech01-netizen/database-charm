import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck, Calculator, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";

import { ShippingCalculatorSchema, type ShippingCalculatorInput, type ShippingOption } from "@/features/shipping/types";
import { calculateShipping } from "@/features/shipping/services/shipping.functions";

import { PageLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSurface } from "@/components/design";
import { MoneyValue } from "@/components/layout/money-value";

export const Route = createFileRoute("/_authenticated/ferramentas/calculadora-frete" as any)({
  component: ShippingCalculatorPage,
});

function ShippingCalculatorPage() {
  const [results, setResults] = useState<ShippingOption[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ShippingCalculatorInput>({
    resolver: zodResolver(ShippingCalculatorSchema),
    defaultValues: {
      cep_origem: "01001-000",
      cep_destino: "",
      peso_kg: 0.3,
      altura_cm: 11,
      largura_cm: 16,
      comprimento_cm: 20,
      valor_declarado: 0,
    },
  });

  async function onSubmit(data: ShippingCalculatorInput) {
    setIsLoading(true);
    setResults(null);
    try {
      // In TanStack Start components, use the function directly or wrap with useServerFn if needed
      // calculateShipping is a server function
      const response = await calculateShipping({ data });
      setResults(response);
      if (response.length === 0) {
        toast.info("Nenhuma opção de frete encontrada para estes critérios.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao calcular frete. Verifique os dados e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Calculadora de Frete"
        description="Consulte preços e prazos de entrega via SuperFrete."
        icon={Calculator}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Dados do Envio
              </CardTitle>
              <CardDescription>
                Informe os detalhes do pacote para cotação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cep_origem"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP Origem</FormLabel>
                          <FormControl>
                            <Input placeholder="00000-000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cep_destino"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP Destino</FormLabel>
                          <FormControl>
                            <Input placeholder="00000-000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="peso_kg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso (kg)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="valor_declarado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Seguro (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="altura_cm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Altura (cm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="largura_cm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Largura (cm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="comprimento_cm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Comprimento (cm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Calculando..." : "Calcular Frete"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-sidebar-border bg-sidebar/10">
              <LoadingSurface variant="component" />
            </div>
          ) : results ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Opções Encontradas
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {results.map((option, idx) => (
                  <Card key={idx} className="overflow-hidden border-sidebar-border/50 transition-all hover:border-primary/30 hover:shadow-sm">
                    <div className="bg-primary/5 px-4 py-2 border-b border-sidebar-border/30">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary/80">
                        {option.transportadora}
                      </p>
                    </div>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-lg font-bold">{option.servico}</p>
                          <p className="text-sm text-muted-foreground">
                            Prazo: {option.prazo_dias} {option.prazo_dias === 1 ? 'dia útil' : 'dias úteis'}
                          </p>
                        </div>
                        <div className="text-right">
                          <MoneyValue 
                            value={option.preco} 
                            className="text-xl font-black text-primary" 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {results.length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Sem resultados</AlertTitle>
                  <AlertDescription>
                    Não foram encontradas opções de frete para os dados informados. Verifique se o CEP de destino é atendido e se as dimensões estão corretas.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-sidebar-border bg-sidebar/5 p-8 text-center text-muted-foreground">
              <Calculator className="mb-4 h-12 w-12 opacity-20" />
              <p className="max-w-xs text-sm">
                Preencha os dados à esquerda e clique em calcular para ver as opções de frete disponíveis.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
