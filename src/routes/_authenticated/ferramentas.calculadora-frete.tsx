import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck, Calculator, AlertCircle, Package, User, MapPin, CreditCard, Download, ExternalLink, Loader2, ChevronDown, Printer, Save, Trash2, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/integrations/supabase/client";

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LoadingSurface } from "@/components/design";
import { MoneyValue } from "@/components/layout/money-value";
import { cn } from "@/lib/utils";

/** Chaves de localStorage — CEP de origem salvo e últimos destinos usados. */
const SAVED_ORIGIN_CEP_KEY = "nexos:frete:cep-origem-salvo";
const RECENT_DEST_CEPS_KEY = "nexos:frete:ceps-destino-recentes";
const MAX_RECENT_CEPS = 5;

export const Route = createFileRoute("/_authenticated/ferramentas/calculadora-frete")({
  component: ShippingCalculatorPage,
});

function ShippingCalculatorPage() {
  const calculateShippingFn = useServerFn(calculateShipping);
  const generateLabelFn = useServerFn(generateLabel);
  
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
      const result = await printManager.printAndWait(
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
  const [destTab, setDestTab] = useState<"novo" | "recentes">("novo");
  const [recentDestCeps, setRecentDestCeps] = useState<string[]>([]);
  const [showExtras, setShowExtras] = useState(false);

  // Carrega o CEP de origem salvo (se houver) e o histórico de destinos
  // recentes — mesma ideia da SuperFrete de lembrar o CEP de quem envia,
  // pra não precisar digitar toda vez.
  useEffect(() => {
    try {
      const savedOrigin = localStorage.getItem(SAVED_ORIGIN_CEP_KEY);
      if (savedOrigin) calcForm.setValue("cep_origem", savedOrigin);
      const recents = localStorage.getItem(RECENT_DEST_CEPS_KEY);
      if (recents) setRecentDestCeps(JSON.parse(recents));
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue sem
      // memorizar, não é crítico pro funcionamento da calculadora.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaveOriginCep() {
    const cep = calcForm.getValues("cep_origem");
    if (!cep) {
      toast.error("Digite um CEP de origem antes de salvar.");
      return;
    }
    try {
      localStorage.setItem(SAVED_ORIGIN_CEP_KEY, cep);
      toast.success("CEP de origem salvo — vai vir preenchido da próxima vez.");
    } catch {
      toast.error("Não foi possível salvar (armazenamento local indisponível).");
    }
  }

  function handleClearOriginCep() {
    calcForm.setValue("cep_origem", "");
    try {
      localStorage.removeItem(SAVED_ORIGIN_CEP_KEY);
    } catch {
      // sem problema, só não limpa o salvo
    }
  }

  function rememberDestCep(cep: string) {
    try {
      const next = [cep, ...recentDestCeps.filter((c) => c !== cep)].slice(0, MAX_RECENT_CEPS);
      setRecentDestCeps(next);
      localStorage.setItem(RECENT_DEST_CEPS_KEY, JSON.stringify(next));
    } catch {
      // sem problema, só não memoriza
    }
  }

  // BUG ENCONTRADO E CORRIGIDO: o remetente de TODA etiqueta emitida
  // por essa tela estava com dados fixos e falsos no código — CNPJ
  // genérico "00.000.000/0001-00", endereço "Av. Paulista, 1000" (não
  // é o endereço real de ninguém), telefone/e-mail de placeholder. Toda
  // etiqueta gerada saía com remetente errado. Corrigido buscando os
  // dados reais cadastrados da empresa (mesmos campos já preenchidos
  // em Configurações).
  const { companyId } = useAuth();
  const { data: companyData } = useQuery({
    queryKey: ["company-sender-info", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, cnpj, zip_code, address, address_number, complement, neighborhood, city, state, email, phone")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
      
      const response = await calculateShippingFn({ data: sanitizedData as any });
      setResults(response.options);
      rememberDestCep(String(data.cep_destino));
      if (response.options.length === 0) {
        toast.info("Nenhuma opção de frete encontrada.");
      }
      if (response.errors.length > 0) {
        response.errors.forEach((msg) => toast.warning(msg));
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao calcular frete.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onLabelSubmit(recipientData: AddressInfo) {
    if (!selectedOption) return;

    // Antes disso era um objeto 100% inventado (CNPJ genérico, endereço
    // "Av. Paulista, 1000" que não existe pra ninguém, telefone de
    // placeholder). Agora usa os dados reais cadastrados da empresa —
    // e bloqueia com uma mensagem clara se o cadastro estiver
    // incompleto, em vez de mandar dado errado pra SuperFrete (que
    // gera dinheiro real gasto numa etiqueta com remetente furado).
    if (
      !companyData?.name ||
      !companyData?.cnpj ||
      !companyData?.address ||
      !companyData?.zip_code ||
      !companyData?.neighborhood ||
      !companyData?.city ||
      !companyData?.state ||
      !companyData?.phone
    ) {
      toast.error(
        "Complete o cadastro da sua empresa (nome, CNPJ, endereço completo e telefone) em Configurações antes de emitir etiquetas.",
        { description: "O remetente da etiqueta é montado a partir desses dados." },
      );
      return;
    }

    setIsLoading(true);
    try {
      const senderData: AddressInfo = {
        name: companyData.name,
        document: companyData.cnpj,
        postal_code: companyData.zip_code || calcForm.getValues("cep_origem"),
        address: companyData.address,
        number: companyData.address_number || "S/N",
        complement: companyData.complement || undefined,
        district: companyData.neighborhood || "",
        city: companyData.city || "",
        state: companyData.state || "",
        email: companyData.email || "",
        phone: companyData.phone || "",
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

      const result = await generateLabelFn({
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
            <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm overflow-hidden">
              <Form {...calcForm}>
                <form onSubmit={calcForm.handleSubmit(onCalcSubmit)}>
                  {/* INFORME A ORIGEM */}
                  <div className="px-5 pt-5 pb-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#E5A855]">
                      Informe a origem
                    </p>
                  </div>
                  <div className="mx-5 mb-5 mt-2 rounded-xl bg-background/40 border border-sidebar-border/40 p-4 space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <FormField
                        control={calcForm.control}
                        name="cep_origem"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs text-muted-foreground">CEP de origem</FormLabel>
                            <FormControl>
                              <Input placeholder="00000-000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2 pb-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-600/20"
                          onClick={handleSaveOriginCep}
                        >
                          <Save className="h-3.5 w-3.5" />
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 bg-muted text-muted-foreground hover:bg-muted/70"
                          onClick={handleClearOriginCep}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={calcForm.control}
                        name="format"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Formato</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
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
                      <FormField
                        control={calcForm.control}
                        name="peso_kg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Peso (kg)</FormLabel>
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
                    </div>

                    <div className={cn(
                      "grid gap-4",
                      calcForm.watch("format") === "3" ? "grid-cols-2" : "grid-cols-3"
                    )}>
                      <FormField
                        control={calcForm.control}
                        name="largura_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Largura (cm)</FormLabel>
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
                      <FormField
                        control={calcForm.control}
                        name="altura_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Altura (cm)</FormLabel>
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
                      {calcForm.watch("format") !== "3" && (
                        <FormField
                          control={calcForm.control}
                          name="comprimento_cm"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Comprimento (cm)</FormLabel>
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

                    <Collapsible open={showExtras} onOpenChange={setShowExtras}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5" />
                            Seguro, aviso e mão própria
                          </span>
                          <ChevronDown
                            className={cn("h-4 w-4 transition-transform", showExtras && "rotate-180")}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <FormField
                          control={calcForm.control}
                          name="valor_declarado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Valor declarado / seguro (R$)</FormLabel>
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
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* INFORME O DESTINO */}
                  <div className="px-5 pb-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#E5A855]">
                      Informe o destino
                    </p>
                  </div>
                  <div className="mx-5 mb-5 mt-2">
                    <Tabs value={destTab} onValueChange={(v) => setDestTab(v as "novo" | "recentes")}>
                      <TabsList className="grid w-full grid-cols-2 bg-background/40">
                        <TabsTrigger value="novo">Novo</TabsTrigger>
                        <TabsTrigger value="recentes" disabled={recentDestCeps.length === 0}>
                          Recentes
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="novo" className="mt-3">
                        <div className="rounded-xl bg-background/40 border border-sidebar-border/40 p-4">
                          <FormField
                            control={calcForm.control}
                            name="cep_destino"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel className="text-xs text-muted-foreground">CEP de destino</FormLabel>
                                  <a
                                    href={`https://buscacepinter.correios.com.br/app/endereco/index.php`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-medium text-[#B392E0] hover:underline"
                                  >
                                    <Search className="h-3 w-3" />
                                    Pesquisar CEP
                                  </a>
                                </div>
                                <FormControl>
                                  <Input placeholder="00000-000" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TabsContent>
                      <TabsContent value="recentes" className="mt-3">
                        <div className="rounded-xl bg-background/40 border border-sidebar-border/40 p-2 space-y-1">
                          {recentDestCeps.map((cep) => (
                            <button
                              key={cep}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-sidebar/40 transition-colors"
                              onClick={() => {
                                calcForm.setValue("cep_destino", cep);
                                setDestTab("novo");
                              }}
                            >
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {cep}
                            </button>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="px-5 pb-5">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cotando...
                        </>
                      ) : (
                        "Calcular frete com desconto"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
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