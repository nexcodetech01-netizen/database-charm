import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Copy, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getPrintBridge } from "../../services/print-bridge.registry";

type Health = {
  status?: string;
  version?: string;
  printers?: number | unknown[];
  printersCount?: number;
};

const BRIDGE_DIR = String.raw`%USERPROFILE%\OneDrive\Desktop\NexOS\Projeto NexOS\apps\nexos-print-bridge`;
const START_COMMANDS = [`cd /d "${BRIDGE_DIR}"`, "npm run dev"];

/**
 * Situação do programa de impressão (Print Bridge) no computador.
 * Ligado: mostra impressoras. Desligado: explica como ligar, sem alarme —
 * sem o Bridge a impressão ainda funciona pela janela do navegador.
 */
export function PrintBridgeStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const bridge = await getPrintBridge();
      setHealth((await bridge.health()) as Health);
    } catch {
      setHealth({ status: "offline" });
    } finally {
      setChecking(false);
    }
  }, []);

  const online = health?.status === "online";
  const loading = health === null;

  // Ao ligar, atualiza as listas de impressoras das outras telas/campos.
  const qc = useQueryClient();
  useEffect(() => {
    if (online) void qc.invalidateQueries({ queryKey: ["printers"] });
  }, [online, qc]);

  // Desligado: confere a cada 10 s, para virar verde sozinho quando ligar.
  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), online ? 30_000 : 10_000);
    return () => clearInterval(id);
  }, [check, online]);

  const printerCount =
    health?.printersCount ??
    (Array.isArray(health?.printers) ? health.printers.length : Number(health?.printers ?? 0));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
              online ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
            )}
          >
            <Printer className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Programa de impressão</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  loading
                    ? "bg-muted text-muted-foreground"
                    : online
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    loading ? "bg-muted-foreground" : online ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                {loading ? "Verificando…" : online ? "Ligado" : "Desligado"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {loading
                ? "Procurando o programa neste computador."
                : online
                  ? `${printerCount} impressora${printerCount === 1 ? "" : "s"} encontrada${printerCount === 1 ? "" : "s"}${health?.version ? ` · versão ${health.version}` : ""}.`
                  : "Sem ele, a etiqueta abre na janela de impressão do navegador. Com ele, sai direto na impressora."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => void check()}
            disabled={checking}
            aria-label="Verificar de novo"
          >
            <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          </Button>
        </div>

        {!online && !loading ? (
          <div className="rounded-lg border bg-muted/30">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
              aria-expanded={showHelp}
            >
              Como ligar
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showHelp && "rotate-180")}
              />
            </button>
            {showHelp ? (
              <div className="space-y-3 border-t px-4 py-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Se você já criou o atalho</span> na
                  Inicialização do Windows, é só reiniciar o computador. O programa liga sozinho.
                </p>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium text-foreground">Para ligar agora:</span> abra o
                    Prompt de Comando (tecla Windows, digite <em>cmd</em>, Enter) e cole um comando
                    de cada vez:
                  </p>
                  {START_COMMANDS.map((cmd) => (
                    <CopyLine key={cmd} text={cmd} />
                  ))}
                  <p>Deixe a janela aberta. Em alguns segundos esta tela fica verde sozinha.</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">{text}</code>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        aria-label="Copiar comando"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Não foi possível copiar.");
          }
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
