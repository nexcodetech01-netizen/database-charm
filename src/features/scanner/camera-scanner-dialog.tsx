import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cameraErrorMessage, createCodeDebouncer } from "./lib/debounce";

/** Biblioteca de leitura, só para aparelhos sem leitor nativo (ex.: iPhone). */
const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";
const FORMATS = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "qr_code"];

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado a cada código lido (já sem repetições seguidas). */
  onCode: (code: string) => void | Promise<void>;
  /** Continua aberta para ler várias peças (PDV); senão fecha na 1ª leitura. */
  continuous?: boolean;
  title?: string;
}

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    osc.frequency.value = 1200;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem som não tem problema */
  }
  try {
    navigator.vibrate?.(60);
  } catch {
    /* idem */
  }
}

/**
 * Leitor de código de barras pela câmera do celular/computador.
 * Usa o leitor nativo do navegador quando existe (Android/Chrome) e, se
 * não, carrega a biblioteca ZXing na hora.
 */
export function CameraScannerDialog({ open, onOpenChange, onCode, continuous, title }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [status, setStatus] = useState<"starting" | "reading" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let zxingControls: { stop: () => void } | null = null;
    const accept = createCodeDebouncer(2500);
    setStatus("starting");
    setError(null);
    setLastCode(null);
    setCount(0);

    const handle = (raw: string) => {
      if (stopped || !accept(raw)) return;
      const code = raw.trim();
      beep();
      setLastCode(code);
      setCount((c) => c + 1);
      void onCodeRef.current(code);
      if (!continuous) onOpenChange(false);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("sem câmera"), { name: "NotFoundError" });
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);

        const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        let formats: string[] = [];
        if (Native?.getSupportedFormats) {
          formats = (await Native.getSupportedFormats()).filter((f) => FORMATS.includes(f));
        }
        if (Native && formats.includes("code_128")) {
          const detector = new Native({ formats });
          setStatus("reading");
          const loop = async () => {
            if (stopped) return;
            try {
              if (video.readyState >= 2) {
                const found = await detector.detect(video);
                if (found[0]?.rawValue) handle(found[0].rawValue);
              }
            } catch {
              /* quadro ruim: tenta no próximo */
            }
            timer = setTimeout(loop, 200);
          };
          void loop();
          return;
        }

        const mod = (await import(/* @vite-ignore */ ZXING_URL)) as {
          BrowserMultiFormatReader: new () => {
            decodeFromVideoElement: (
              el: HTMLVideoElement,
              cb: (result: { getText: () => string } | undefined) => void,
            ) => Promise<{ stop: () => void }>;
          };
        };
        if (stopped) return;
        const reader = new mod.BrowserMultiFormatReader();
        setStatus("reading");
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) handle(result.getText());
        });
      } catch (err) {
        if (stopped) return;
        setStatus("error");
        setError(cameraErrorMessage(err));
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      try {
        zxingControls?.stop();
      } catch {
        /* já parado */
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, continuous, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> {title ?? "Ler código pela câmera"}
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o código de barras da etiqueta, a uns 15 cm. Com boa luz é mais
            rápido.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          {status === "reading" ? (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          ) : null}
          {status === "starting" ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo a câmera…
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {lastCode ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Lido: <span className="font-mono">{lastCode}</span>
            {continuous && count > 1 ? <span className="text-muted-foreground">({count} leituras)</span> : null}
          </p>
        ) : null}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{continuous ? "Concluir" : "Fechar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
