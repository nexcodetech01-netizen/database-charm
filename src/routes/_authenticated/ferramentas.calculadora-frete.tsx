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

import { PageLayout, PageHeader, BreadcrumbNav } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { LoadingSurface } from "@/components/design";
import { EmptyState } from "@/components/layout";
import { MoneyValue } from "@/components/layout/money-value";
import { cn } from "@/lib/utils";

/** Chaves de localStorage — CEP de origem salvo e últimos destinos usados. */
const SAVED_ORIGIN_CEP_KEY = "nexos:frete:cep-origem-salvo";
const RECENT_DEST_CEPS_KEY = "nexos:frete:ceps-destino-recentes";
const RECENT_QUOTES_KEY = "nexos:frete:recent-quotes";
const MAX_RECENT_CEPS = 5;

interface RecentQuote {
  timestamp: number;
  input: ShippingCalculatorInput;
  results: ShippingOption[];
}

export const Route = createFileRoute("/_authenticated/ferramentas/calculadora-frete")({
  component: ShippingCalculatorPage,
});

function ShippingCalculatorPage() {
  const calculateShippingFn = useServerFn(calculateShipping);
  const generateLabelFn = useServerFn(generateLabel);
  
  const [step, setStep] = useState<1 | 2>(1);
  const [results, setResults] = useState<ShippingOption[] | null>(null);
  const [calcErrors, setCalcErrors] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [labelResult, setLabelResult] = useState<LabelResult | null>(null);
  const [printing, setPrinting] = useState(false);
  const [calcError, setCalcError] = useState<{ message: string; details?: string[] } | null>(null);

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
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
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

      const quotes = localStorage.getItem(RECENT_QUOTES_KEY);
      if (quotes) {
        const parsedQuotes = JSON.parse(quotes);
        setRecentQuotes(parsedQuotes);
        if (parsedQuotes.length > 0) {
          setDestTab("recentes");
        }
      }
    } catch {
      // localStorage indisponível
    }
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

  function saveRecentQuote(input: ShippingCalculatorInput, options: ShippingOption[]) {
    try {
      const newQuote: RecentQuote = {
        timestamp: Date.now(),
        input,
        results: options
      };
      const next = [newQuote, ...recentQuotes].slice(0, 10);
      setRecentQuotes(next);
      localStorage.setItem(RECENT_QUOTES_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("Failed to save recent quote", err);
    }
  }

  function applyRecentQuote(quote: RecentQuote) {
    calcForm.reset(quote.input);
    setResults(quote.results);
    setStep(1);
    setDestTab("novo");
    toast.success("Cotação anterior carregada.");
  }

  const formatCep = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 5) return clean;
    return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
  };

  const formatNumeric = (value: string) => {
    // Permite apenas números e uma única vírgula ou ponto
    const clean = value.replace(/[^0-9,.]/g, "");
    const parts = clean.split(/[,.]/);
    if (parts.length > 2) {
      return parts[0] + "," + parts.slice(1).join("");
    }
    return clean.replace(".", ",");
  };


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
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const calcForm = useForm<any>({
    resolver: zodResolver(ShippingCalculatorSchema),
    mode: "onChange",
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
    setCalcError(null);
    setCalcErrors([]);
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
      saveRecentQuote(sanitizedData as any, response.options);
      if (response.options.length === 0) {
        toast.info("Nenhuma opção de frete encontrada.");
      }
      if (response.errors.length > 0) {
        // MELHORIA: antes o motivo específico (ex.: "dimensão abaixo do
        // mínimo aceito") só aparecia num toast passageiro — sumia da
        // tela rápido e a caixa de aviso fixa sempre mostrava a mesma
        // mensagem genérica, sem dizer o motivo real nem o tamanho
        // aceito. Agora o motivo fica guardado e aparece de forma
        // permanente na caixa de aviso, junto com a mensagem genérica.
        setCalcErrors(response.errors);
        response.errors.forEach((msg) => toast.warning(msg));
      }
    } catch (error: any) {
      const errorMessage = error.message || "Erro inesperado ao calcular frete.";
      setCalcError({ 
        message: errorMessage, 
        details: ["Verifique sua conexão ou se os dados de CEP e dimensões estão corretos."] 
      });
      toast.error(errorMessage);
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
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <BreadcrumbNav />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Frete e Etiquetas
              </h1>
              <Badge variant="secondary" className="font-mono text-[10px] tracking-wider uppercase">SuperFrete</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Calcule fretes e gere etiquetas para seus pedidos.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-6">
          {step === 1 ? (
            <div className="space-y-6">
              <Card className="border-border bg-card shadow-sm overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Origem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Form {...calcForm}>
                    <form onSubmit={calcForm.handleSubmit(onCalcSubmit)} className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-end gap-3">
                        <FormField
                          control={calcForm.control}
                          name="cep_origem"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">CEP de origem</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="00000-000" 
                                  {...field} 
                                  onChange={(e) => field.onChange(formatCep(e.target.value))}
                                  className="h-10 bg-background/60 border-sidebar-border/40 focus:border-[#E5A855]/50 transition-colors"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-10 px-3 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-600/20 rounded-lg transition-all"
                            onClick={handleSaveOriginCep}
                            title="Salvar CEP"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-10 px-3 bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-sidebar-border/40 rounded-lg transition-all"
                            onClick={handleClearOriginCep}
                            title="Limpar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={calcForm.control}
                          name="format"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">Formato</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-10 bg-background/60 border-sidebar-border/40">
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
                              <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">Peso (kg)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="0,3"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(formatNumeric(e.target.value))}
                                  className="h-10 bg-background/60 border-sidebar-border/40"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className={cn(
                        "grid gap-4",
                        calcForm.watch("format") === "3" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"
                      )}>

                        <FormField
                          control={calcForm.control}
                          name="largura_cm"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">Largura (cm)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="16"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(formatNumeric(e.target.value))}
                                  className="h-10 bg-background/60 border-sidebar-border/40"
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
                              <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">Altura (cm)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="11"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(formatNumeric(e.target.value))}
                                  className="h-10 bg-background/60 border-sidebar-border/40"
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
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">Comprimento (cm)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="20"
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(formatNumeric(e.target.value))}
                                    className="h-10 bg-background/60 border-sidebar-border/40"
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
                            className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block">Valor declarado / seguro (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="0,00"
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(formatNumeric(e.target.value))}
                                    className="h-10 bg-background/60 border-sidebar-border/40"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>

                            )}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Destino
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl bg-background/40 border border-border/40 overflow-hidden">
                      <Tabs value={destTab} onValueChange={(v) => setDestTab(v as "novo" | "recentes")} className="w-full">
                        <TabsList className="w-full justify-start h-12 bg-transparent rounded-none border-b border-sidebar-border/40 p-0">
                          <TabsTrigger 
                            value="novo" 
                            className="h-full px-6 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#E5A855] text-xs uppercase font-bold tracking-wider"
                          >
                            Novo
                          </TabsTrigger>
                          <TabsTrigger 
                            value="recentes" 
                            disabled={recentDestCeps.length === 0 && recentQuotes.length === 0}
                            className="h-full px-6 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#E5A855] text-xs uppercase font-bold tracking-wider"
                          >
                            Recentes
                          </TabsTrigger>
                        </TabsList>
                        
                        <div className="p-5">
                          <TabsContent value="novo" className="mt-0 space-y-4">
                            <FormField
                              control={calcForm.control}
                              name="cep_destino"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground block">CEP de destino</FormLabel>
                                    <a
                                      href={`https://buscacepinter.correios.com.br/app/endereco/index.php`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#B392E0] hover:text-[#B392E0]/80 transition-colors"
                                    >
                                      <Search className="h-3 w-3" />
                                      Pesquisar CEP
                                    </a>
                                  </div>
                                  <FormControl>
                                    <Input 
                                      placeholder="00000-000" 
                                      {...field} 
                                      onChange={(e) => field.onChange(formatCep(e.target.value))}
                                      className="h-10 bg-background/60 border-sidebar-border/40 focus:border-[#E5A855]/50"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>
                          
                          <TabsContent value="recentes" className="mt-0">
                            <div className="space-y-4">
                              {recentQuotes.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Cotações Anteriores</p>
                                  <div className="grid grid-cols-1 gap-2">
                                    {recentQuotes.map((quote, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        className="flex flex-col gap-1 rounded-lg px-3 py-2 text-sm text-left hover:bg-sidebar/40 border border-sidebar-border/20 transition-all group"
                                        onClick={() => applyRecentQuote(quote)}
                                      >
                                        <div className="flex justify-between items-center w-full">
                                          <span className="font-bold text-[10px] text-primary">{quote.input.cep_destino}</span>
                                          <span className="text-[9px] text-muted-foreground">{new Date(quote.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground font-medium">
                                          <span>{quote.input.peso_kg}kg</span>
                                          <span>•</span>
                                          <span>{quote.input.largura_cm}x{quote.input.altura_cm}x{quote.input.comprimento_cm}cm</span>
                                          <span>•</span>
                                          <span className="text-emerald-500">{quote.results.length} opções</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {recentDestCeps.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">CEPs Frequentes</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {recentDestCeps.map((cep) => (
                                      <button
                                        key={cep}
                                        type="button"
                                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-left hover:bg-sidebar/40 border border-sidebar-border/20 transition-all group"
                                        onClick={() => {
                                          calcForm.setValue("cep_destino", cep);
                                          setDestTab("novo");
                                        }}
                                      >
                                        <MapPin className="h-3 w-3 text-muted-foreground group-hover:text-[#E5A855] transition-colors" />
                                        <span className="font-medium">{cep}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        </div>
                      </Tabs>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={calcForm.handleSubmit(onCalcSubmit)}
              disabled={isLoading}
              className="w-full h-12 text-sm font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/10 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  COTANDO...
                </>
              ) : (
                "Calcular frete"
              )}
            </Button>
          </div>
        ) : (
          <Card className="border-border bg-card shadow-sm overflow-hidden lg:sticky lg:top-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Package className="h-4 w-4" />
                Cotação Selecionada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="p-4 rounded-xl bg-background/40 border border-border/40 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-base">{selectedOption?.servico}</p>
                    <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{selectedOption?.transportadora}</p>
                  </div>
                  <MoneyValue value={selectedOption?.preco || 0} className="text-xl font-black text-primary" />
                </div>
                <div className="h-px bg-border/40 w-full" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  <span>Prazo estimado: <strong>{selectedOption?.prazo_dias} dias úteis</strong></span>
                </div>
              </div>

              <Button 
                variant="ghost" 
                className="w-full h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/30" 
                onClick={() => setStep(1)}
              >
                Alterar Cotação
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-7">
        {step === 1 ? (
          isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
              <LoadingSurface variant="cards" metrics={1} />
            </div>
          ) : calcError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-destructive mb-1">Não foi possível calcular o frete</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {calcError.message}. Verifique os CEPs e as dimensões informadas e tente novamente.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest border-destructive/30 hover:bg-destructive/10"
                    onClick={() => calcForm.handleSubmit(onCalcSubmit)()}
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            </div>
          ) : results ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Opções Disponíveis
                </h3>
                <Badge variant="outline" className="text-[10px]">{results.length} resultados</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {results.map((option, idx) => (
                  <Card 
                    key={idx} 
                    className={cn(
                      "overflow-hidden border-border transition-all cursor-pointer group hover:border-primary/50 hover:shadow-md bg-card/50",
                      selectedOption?.id === option.id && "border-primary ring-1 ring-primary"
                    )}
                    onClick={() => handleSelectOption(option)}
                  >
                    <div className="bg-primary/5 px-4 py-2 border-b border-border/50 flex justify-between items-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {option.transportadora}
                      </p>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-base font-bold">{option.servico}</p>
                          <p className="text-[11px] text-muted-foreground font-medium">
                            Prazo: {option.prazo_dias} {option.prazo_dias === 1 ? 'dia útil' : 'dias úteis'}
                          </p>
                        </div>
                        <div className="text-right">
                          <MoneyValue 
                            value={option.preco} 
                            className="text-lg font-black text-primary" 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {results.length === 0 && (
                <EmptyState
                  icon={AlertCircle}
                  title="Nenhuma opção encontrada"
                  description={
                    calcErrors.length > 0 ? (
                      <ul className="mt-2 text-xs space-y-1">
                        {calcErrors.map((msg, i) => <li key={i} className="text-destructive font-medium">• {msg}</li>)}
                      </ul>
                    ) : "Não encontramos frete para este CEP ou dimensões."
                  }
                />
              )}
            </div>
          ) : (
            <EmptyState
              icon={Truck}
              title="Cotação de frete"
              description="Preencha os dados do envio para consultar as opções disponíveis."
              className="h-[400px]"
            />
          )
        ) : (
          <Card className="border-border bg-card shadow-sm">
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

                    <div className="pt-6 border-t border-border/50">
                      <Button type="submit" className="w-full h-12 text-sm font-bold uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20" disabled={isLoading}>
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Emitindo e Pagando...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>Emitir Etiqueta • <MoneyValue value={selectedOption?.preco || 0} /></span>
                          </div>
                        )}
                      </Button>
                      <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-2">
                        <Shield className="h-3.5 w-3.5 text-primary mt-0.5" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          Seguro NexOS: O valor será debitado do seu saldo <strong>SuperFrete</strong> de forma segura e instantânea.
                        </p>
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}