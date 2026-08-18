import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck, Calculator, AlertCircle, Package, User, MapPin, CreditCard, Download, ExternalLink, Loader2, ChevronDown, Printer } from "lucide-react";
import { toast } from "sonner";

import { 
  ShippingCalculatorSchema, 
  AddressSchema,
  type ShippingCalculatorInput, 
  type ShippingOption, 
  type AddressInfo,
  type LabelResult
} from "@/features/shipping/types";
import { calculateShipping, generateLabel } from "@/features/shipping/services/shipping.functions";
import { printManager } from "@/features/printing/services/print.service";
import type { Printer as PrinterInfo } from "@/features/printing/types/printing.types";

import { PageLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSurface } from "@/components/design";
import { MoneyValue } from "@/components/layout/money-value";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ferramentas/calculadora-frete")({
  component: ShippingCalculatorPage,
});

function ShippingCalculatorPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [results, setResults] = useState<ShippingOption[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [labelResult, setLabelResult] = useState<LabelResult | null>(null);
  const [printing, setPrinting] = useState(false);

  async function handlePrintThermal() {
    if (!labelResult?.label_url) return;
    setPrinting(true);
    try {
      const printers = await printManager.getPrinters();
      const defaultPrinter =
        printers.find((p: PrinterInfo) => p.isDefault) ??
        printers.find((p: PrinterInfo) => p.name === "LABEL TERMICA");
      if (!defaultPrinter) {
        toast.error("Impressora térmica não encontrada. Confira se o Print Bridge está conectado.");
        return;
      }
      const result = await printManager.print(
        { id: `superfrete-${labelResult.order_id}`, pdf: labelResult.label_url },
        { strategy: "PDF", printerId: defaultPrinter.id, type: "LABEL" },
      );
      if (result.success) {
        toast.success("Etiqueta enviada pra impressão.");
      } else {
        toast.error(result.message || "Falha ao imprimir.");
      }
    } catch (err) {
      toast.error("Não foi possível imprimir.", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPrinting(false);
    }
  }
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const calcForm = useForm<any>({
    resolver: zodResolver(ShippingCalculatorSchema),
    defaultValues: {
      format: "3",
      cep_origem: "01001-000",
      cep_destino: "",
      peso_kg: "0.3",
      altura_cm: "2",
      largura_cm: "16",
      comprimento_cm: "20",
      valor_declarado: "0",
    },
  });

  const labelForm = useForm<AddressInfo>({
    resolver: zodResolver(AddressSchema),
    defaultValues: {
      name: "",
      document: "",
      postal_code: "",
      address: "",
      number: "",
      complement: "",
      district: "",
      city: "",
      state: "",
      email: "",
      phone: "",
      invoice_number: "",
    },
  });

  async function onCalcSubmit(data: ShippingCalculatorInput) {
    setIsLoading(true);
    setResults(null);
    setSelectedOption(null);
    console.log("CALCULATOR_DEBUG: Submitting form data:", data);
    try {
      // Sanitização manual para garantir tipos numéricos antes de enviar para a Server Function
      const sanitizedData = {
        ...data,
        peso_kg: parseFloat(String(data.peso_kg).replace(',', '.')),
        altura_cm: parseFloat(String(data.altura_cm).replace(',', '.')),
        largura_cm: parseFloat(String(data.largura_cm).replace(',', '.')),
        comprimento_cm: parseFloat(String(data.comprimento_cm).replace(',', '.')),
        valor_declarado: parseFloat(String(data.valor_declarado).replace(',', '.')),
        format: String(data.format),
      };
      
      const response = await calculateShipping({ data: sanitizedData as any });
      setResults(response);
      if (response.length === 0) {
        toast.info("Nenhuma opção de frete encontrada.");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao calcular frete.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onLabelSubmit(recipientData: AddressInfo) {
    if (!selectedOption) return;

    setIsLoading(true);
    try {
      // For sender, we'd normally pull from secrets via server function, 
      // but the requirement asks for a form where sender can be pre-filled.
      // For now, we'll use a placeholder sender and let the server function handle defaults if needed.
      const senderData: AddressInfo = {
        name: "NexOS Fashion",
        document: "00.000.000/0001-00",
        postal_code: calcForm.getValues("cep_origem"),
        address: "Av. Paulista",
        number: "1000",
        district: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        email: "admin@nexxcode.com.br",
        phone: "11999999999",
      };

      const calcValues = calcForm.getValues();
      const sanitizedPackage = {
        ...calcValues,
        peso_kg: parseFloat(String(calcValues.peso_kg).replace(',', '.')),
        altura_cm: parseFloat(String(calcValues.altura_cm).replace(',', '.')),
        largura_cm: parseFloat(String(calcValues.largura_cm).replace(',', '.')),
        comprimento_cm: parseFloat(String(calcValues.comprimento_cm).replace(',', '.')),
        valor_declarado: parseFloat(String(calcValues.valor_declarado).replace(',', '.')),
        format: String(calcValues.format),
      };

      const payload = {
        service_code: selectedOption.id,
        sender: senderData,
        recipient: recipientData,
        package_details: sanitizedPackage,
      };
      
      console.log("SHIPPING_DEBUG: Sending label payload:", payload);

      const result = await generateLabel({
        data: payload as any
      });

      setLabelResult(result);
      toast.success("Etiqueta gerada com sucesso!");
    } catch (error: any) {
      console.error("SHIPPING_DEBUG: Label error:", error);
      toast.error(error.message || "Erro ao emitir etiqueta. Verifique o saldo.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleCepBlur = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        labelForm.setValue("address", data.logradouro || "");
        labelForm.setValue("district", data.bairro || "");
        labelForm.setValue("city", data.localidade || "");
        labelForm.setValue("state", data.uf || "");
        // Focus on number field if possible or just let user continue
        toast.info("Endereço preenchido automaticamente.");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleSelectOption = (option: ShippingOption) => {
    setSelectedOption(option);
    labelForm.setValue("postal_code", calcForm.getValues("cep_destino"));
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (labelResult) {
    return (
      <PageLayout title="Etiqueta Gerada">
        <PageHeader
          title="Etiqueta Gerada"
          description="Sua etiqueta de envio foi emitida com sucesso."
          icon={Truck}
        />
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Package className="h-6 w-6" />
                Pronto para Envio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">Código de Rastreio</p>
                  <p className="text-2xl font-mono font-bold tracking-wider">{labelResult.tracking_code || "Aguardando..."}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase font-semibold">ID do Pedido</p>
                  <p className="text-xl font-bold">{labelResult.order_id || "N/A"}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {labelResult.label_url && (
                  <>
                    <Button
                      className="flex-1 h-14 text-lg"
                      onClick={handlePrintThermal}
                      disabled={printing}
                    >
                      {printing ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Printer className="mr-2 h-5 w-5" />
                      )}
                      Imprimir na Térmica
                    </Button>
                    <Button asChild variant="outline" className="flex-1 h-14 text-lg">
                      <a href={labelResult.label_url} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-5 w-5" />
                        Baixar Etiqueta (PDF)
                      </a>
                    </Button>
                  </>
                )}
                <Button variant="outline" className="flex-1 h-14 text-lg" onClick={() => {
                  setLabelResult(null);
                  setStep(1);
                  setResults(null);
                  setSelectedOption(null);
                }}>
                  Nova Cotação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Frete e Etiquetas">
      <PageHeader
        title="Gestão de Frete SuperFrete"
        description={step === 1 ? "Consulte preços e prazos de entrega." : "Informe os dados do destinatário para emitir a etiqueta."}
        icon={Truck}
      />

      <div className="flex items-center gap-4 mb-8">
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors",
          step === 1 ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-muted text-muted-foreground"
        )}>1</div>
        <div className="h-px w-8 bg-muted" />
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors",
          step === 2 ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-muted text-muted-foreground"
        )}>2</div>
        <div className="h-px w-8 bg-muted" />
        <div className="flex items-center justify-center h-10 w-10 rounded-full border-2 bg-muted border-muted text-muted-foreground">3</div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {step === 1 ? (
            <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Passo 1: Cotação
                </CardTitle>
                <CardDescription>
                  Dimensões e CEPs do pacote.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...calcForm}>
                  <form onSubmit={calcForm.handleSubmit(onCalcSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={calcForm.control}
                        name="format"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Formato</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o formato" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">Caixa / Pacote</SelectItem>
                                <SelectItem value="2">Rolo / Cilindro</SelectItem>
                                <SelectItem value="3">Envelope</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={calcForm.control}
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
                        control={calcForm.control}
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
                        control={calcForm.control}
                        name="peso_kg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso (kg)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="0,3"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={calcForm.control}
                        name="valor_declarado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor Seguro (R$)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="0,00"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className={cn(
                      "grid gap-3",
                      calcForm.watch("format") === "3" ? "grid-cols-2" : "grid-cols-3"
                    )}>
                      <FormField
                        control={calcForm.control}
                        name="altura_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Altura (cm)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="11"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={calcForm.control}
                        name="largura_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Largura (cm)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="16"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {calcForm.watch("format") !== "3" && (
                        <FormField
                          control={calcForm.control}
                          name="comprimento_cm"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Comp. (cm)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="20"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Cotando..." : "Calcular Opções"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Cotação Selecionada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-primary/10">
                  <div>
                    <p className="font-bold text-lg">{selectedOption?.servico}</p>
                    <p className="text-sm text-muted-foreground">{selectedOption?.transportadora}</p>
                  </div>
                  <MoneyValue value={selectedOption?.preco || 0} className="text-xl font-black text-primary" />
                </div>
                <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
                  Alterar Cotação
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-7">
          {step === 1 ? (
            isLoading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-sidebar-border bg-sidebar/10">
                <LoadingSurface variant="cards" metrics={1} />
              </div>
            ) : results ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Opções Disponíveis
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {results.map((option, idx) => (
                    <Card 
                      key={idx} 
                      className={cn(
                        "overflow-hidden border-sidebar-border/50 transition-all cursor-pointer group hover:border-primary/50 hover:shadow-md",
                        selectedOption?.id === option.id && "border-primary ring-1 ring-primary"
                      )}
                      onClick={() => handleSelectOption(option)}
                    >
                      <div className="bg-primary/5 px-4 py-2 border-b border-sidebar-border/30 flex justify-between items-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary/80">
                          {option.transportadora}
                        </p>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                    <AlertTitle>Nenhuma opção</AlertTitle>
                    <AlertDescription>
                      Não encontramos frete para este CEP ou dimensões.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-sidebar-border bg-sidebar/5 p-8 text-center text-muted-foreground">
                <Calculator className="mb-4 h-12 w-12 opacity-20" />
                <p className="max-w-xs text-sm">
                  Escolha as dimensões e clique em calcular.
                </p>
              </div>
            )
          ) : (
            <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Passo 2: Destinatário
                </CardTitle>
                <CardDescription>
                  Dados para emissão da etiqueta oficial.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...labelForm}>
                  <form onSubmit={labelForm.handleSubmit(onLabelSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={labelForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do cliente" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={labelForm.control}
                        name="document"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF/CNPJ</FormLabel>
                            <FormControl>
                              <Input placeholder="000.000.000-00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={labelForm.control}
                        name="postal_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              CEP
                              {isFetchingCep && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="00000-000" 
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  if (e.target.value.replace(/\D/g, "").length === 8) {
                                    handleCepBlur(e.target.value);
                                  }
                                }}
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleCepBlur(e.target.value);
                                }}
                                disabled={isFetchingCep}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="md:col-span-2">
                        <FormField
                          control={labelForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endereço</FormLabel>
                              <FormControl>
                                <Input placeholder="Rua, Av..." {...field} disabled={isFetchingCep} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FormField
                        control={labelForm.control}
                        name="number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input placeholder="123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={labelForm.control}
                        name="complement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input placeholder="Apto, Sala..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={labelForm.control}
                        name="district"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input placeholder="Bairro" {...field} disabled={isFetchingCep} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={labelForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UF</FormLabel>
                            <FormControl>
                              <Input placeholder="SP" maxLength={2} {...field} disabled={isFetchingCep} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={labelForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input placeholder="Cidade" {...field} disabled={isFetchingCep} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={labelForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail (Opcional)</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="cliente@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={labelForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="(00) 00000-0000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="pt-4 border-t border-sidebar-border/30">
                      <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
                        {isLoading ? "Emitindo e Pagando..." : `Emitir Etiqueta - R$ ${selectedOption?.preco.toFixed(2)}`}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-4">
                        Ao clicar, o valor será debitado do seu saldo SuperFrete.
                      </p>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}