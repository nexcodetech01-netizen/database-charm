import { Fragment, useEffect, useState } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFiscalArtifact } from "../hooks/use-fiscal";
import {
  buildXmlFileName,
  downloadText,
  formatXml,
  type XmlNaming,
} from "../lib/xml-file";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string | null | undefined;
  doc: XmlNaming;
}

/** Destaque simples de sintaxe XML (tags, atributos, valores). */
function HighlightedXml({ xml }: { xml: string }) {
  const pattern = /(<)(\/?)([\w:.-]+)|([\w:.-]+)=("[^"]*")|(\/?>)/g;

  return (
    <>
      {xml.split("\n").map((line, i) => {
        const parts: React.ReactNode[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(line)) !== null) {
          if (m.index > last) parts.push(line.slice(last, m.index));
          if (m[3]) {
            parts.push(
              <Fragment key={`${i}-${m.index}`}>
                <span className="text-muted-foreground">{`<${m[2]}`}</span>
                <span className="text-primary">{m[3]}</span>
              </Fragment>,
            );
          } else if (m[4]) {
            parts.push(
              <Fragment key={`${i}-${m.index}`}>
                <span className="text-amber-600 dark:text-amber-400">{m[4]}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-emerald-600 dark:text-emerald-400">{m[5]}</span>
              </Fragment>,
            );
          } else {
            parts.push(
              <span key={`${i}-${m.index}`} className="text-muted-foreground">
                {m[0]}
              </span>,
            );
          }
          last = m.index + m[0].length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return (
          <div key={i} className="whitespace-pre">
            {parts}
          </div>
        );
      })}
    </>
  );
}

/**
 * Modal de visualização do XML da NF-e.
 * O conteúdo armazenado nunca é alterado — só formatado para leitura.
 */
export function XmlViewerDialog({ open, onOpenChange, path, doc }: Props) {
  const artifact = useFiscalArtifact();
  const [xml, setXml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileName = buildXmlFileName(doc);
  const getUrl = artifact.mutateAsync;

  useEffect(() => {
    if (!open || !path) return;
    let cancelled = false;
    setLoading(true);
    setXml(null);
    (async () => {
      try {
        const { url } = await getUrl(path);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Falha ao carregar o XML.");
        const text = await res.text();
        if (!cancelled) setXml(formatXml(text));
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar o XML.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, path, getUrl]);

  async function copyXml() {
    if (!xml) return;
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      toast.success("XML copiado.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o XML.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Visualizar XML</DialogTitle>
          <DialogDescription>
            {fileName} · exibição formatada. O arquivo original permanece inalterado.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] rounded-md border bg-muted/30">
          <div className="p-4 font-mono text-xs leading-relaxed">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando XML…
              </div>
            ) : xml ? (
              <HighlightedXml xml={xml} />
            ) : (
              <span className="text-muted-foreground">XML indisponível.</span>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyXml} disabled={!xml}>
              {copied ? (
                <Check className="mr-1.5 h-4 w-4" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              Copiar XML
            </Button>
            <Button onClick={() => xml && downloadText(xml, fileName)} disabled={!xml}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar XML
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
