import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Check, Sparkles, RefreshCcw, Instagram } from "lucide-react";
import { toast } from "sonner";
import { ProductThumb } from "@/features/products/components/product-thumb";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SALES_CHANNELS,
  generateSalesContent,
  type ContentBlock,
  type ProductForSales,
  type SalesChannel,
} from "./generate-sales-content";
import { useNextAction } from "@/components/feedback/next-action-provider";

/**
 * Central de Vendas — Dialog único para todos os canais.
 *
 * - Nunca abre vazio: conteúdo é gerado no momento em que a aba é aberta.
 * - Mesmo layout para os 7 canais.
 * - Cada bloco tem "Copiar"; um botão "Copiar tudo" no rodapé de cada aba.
 * - "Gerar novamente" recalcula o conteúdo local (mesma função determinística).
 */
export interface SalesCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductForSales;
}

export function SalesCenterDialog({ open, onOpenChange, product }: SalesCenterDialogProps) {
  const [channel, setChannel] = useState<SalesChannel>("instagram");
  // rev bump força regeneração via useMemo — nenhum estado por bloco.
  const [rev, setRev] = useState(0);
  const showNextAction = useNextAction();

  const contentByChannel = useMemo(() => {
    const map: Record<SalesChannel, ContentBlock[]> = {} as Record<SalesChannel, ContentBlock[]>;
    for (const c of SALES_CHANNELS) {
      map[c.id] = generateSalesContent(c.id, product).blocks;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, rev]);



  const copyAll = async () => {
    const allText = SALES_CHANNELS.map((c) => {
      const blocks = contentByChannel[c.id] ?? [];
      return `=== ${c.label} ===\n${blocks.map((b) => `${b.label}:\n${b.value}`).join("\n\n")}`;
    }).join("\n\n");
    await navigator.clipboard.writeText(allText);
    onOpenChange(false);
    showNextAction({
      title: "Tudo pronto",
      summary: SALES_CHANNELS.map((c) => c.label),
      question: "O que deseja fazer agora?",
      primaryAction: {
        label: "Copiar tudo novamente",
        onClick: () => void navigator.clipboard.writeText(allText).then(() => toast.success("Copiado")),
      },
      secondaryActions: [
        { label: "Ver produtos", to: "/produtos" },
      ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b border-border px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Central de Vendas</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Escolha o canal. A Bella já preparou o conteúdo — só revisar e enviar.
          </DialogDescription>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2">
            <ProductThumb path={product.cover_image_path ?? null} alt={product.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              {product.brand ? (
                <p className="truncate text-xs text-muted-foreground">{product.brand}</p>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={channel} onValueChange={(v) => setChannel(v as SalesChannel)} className="min-w-0">
          <div className="border-b border-border px-4 sm:px-6">
            <ScrollArea className="w-full">
              <TabsList className="h-10 w-max min-w-full justify-start gap-1 bg-transparent p-0">
                {SALES_CHANNELS.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={c.id}
                    className="shrink-0 whitespace-nowrap rounded-md data-[state=active]:bg-accent"
                  >
                    <span className="mr-1.5">{c.emoji}</span>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </div>

          {SALES_CHANNELS.map((c) => (
            <TabsContent key={c.id} value={c.id} className="m-0 min-w-0">
              <div className="px-4 pt-4 pb-2 text-xs text-muted-foreground sm:px-6">{c.hint}</div>
              <ScrollArea className="max-h-[60vh]">
                <div className="min-w-0 space-y-4 px-4 pb-6 sm:px-6">
                  {contentByChannel[c.id].map((block, i) => (
                    <BlockEditor key={`${c.id}-${i}-${rev}`} block={block} />
                  ))}
                </div>
              </ScrollArea>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRev((r) => r + 1)}
                  className="text-muted-foreground"
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Gerar novamente
                </Button>
                <div className="flex flex-wrap gap-2">
                  {c.id === "instagram" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const caption =
                            contentByChannel.instagram.find((b) => /legenda/i.test(b.label))?.value ?? "";
                          await navigator.clipboard.writeText(caption);
                          toast.success("Legenda copiada");
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar legenda
                      </Button>
                      <Button asChild variant="secondary" size="sm">
                        <Link
                          to="/configuracoes/integracoes/meta"
                          onClick={() => onOpenChange(false)}
                        >
                          <Instagram className="mr-1.5 h-3.5 w-3.5" /> Publicar no Instagram
                        </Link>
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button size="sm" onClick={copyAll}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar tudo
                  </Button>
                </div>

              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- bloco editável -------------------------- */

function BlockEditor({ block }: { block: ContentBlock }) {
  const [value, setValue] = useState(block.value);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${block.label} copiado`);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{block.label}</label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onCopy}
        >
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </>
          )}
        </Button>
      </div>
      {block.multiline ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={Math.min(10, Math.max(3, value.split("\n").length + 1))}
          className="font-normal"
        />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      )}
    </div>
  );
}
