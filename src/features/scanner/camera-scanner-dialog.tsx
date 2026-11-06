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
const ZXING_LIB_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/+esm";
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
        // Resolução alta + foco contínuo: barras finas (etiqueta 40 mm)
        // não são lidas na resolução padrão (640×480).
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        try {
          const track = stream.getVideoTracks()[0];
          const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] };
          if (caps.focusMode?.includes("continuous")) {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
          }
        } catch {
          /* sem controle de foco: segue */
        }
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

        const [mod, lib] = (await Promise.all([
          import(/* @vite-ignore */ ZXING_URL),
          import(/* @vite-ignore */ ZXING_LIB_URL),
        ])) as [
          {
          BrowserMultiFormatReader: new (hints?: Map<unknown, unknown>, opts?: { delayBetweenScanAttempts?: number }) => {
            decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText: () => string };
          };
          },
          {
            DecodeHintType: Record<string, unknown>;
            BarcodeFormat: Record<string, unknown>;
          },
        ];
        if (stopped) return;
        // "Tentar com mais esforço" e só os formatos das etiquetas.
        const hints = new Map<unknown, unknown>();
        hints.set(lib.DecodeHintType.TRY_HARDER, true);
        hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
          lib.BarcodeFormat.QR_CODE,
          lib.BarcodeFormat.CODE_128,
          lib.BarcodeFormat.EAN_13,
          lib.BarcodeFormat.EAN_8,
          lib.BarcodeFormat.UPC_A,
          lib.BarcodeFormat.CODE_39,
        ]);
        const reader = new mod.BrowserMultiFormatReader(hints);
        setStatus("reading");
        // Lê quadro a quadro num canvas. (decodeFromVideoElement espera o
        // evento "canplay", que no iPhone já passou: ficava parado sem ler.)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let useCrop = false;
        const tick = () => {
          if (stopped) return;
          try {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            if (ctx && vw > 0 && vh > 0) {
              // Alterna: quadro inteiro (reduzido) e o centro em tamanho real,
              // para a etiqueta pequena no meio da imagem ter detalhe.
              let sx = 0;
              let sy = 0;
              let sw = vw;
              let sh = vh;
              if (useCrop) {
                sw = Math.round(vw * 0.6);
                sh = Math.round(vh * 0.6);
                sx = Math.round((vw - sw) / 2);
                sy = Math.round((vh - sh) / 2);
              }
              useCrop = !useCrop;
              const scale = Math.min(1, 1000 / sw);
              canvas.width = Math.round(sw * scale);
              canvas.height = Math.round(sh * scale);
              ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
              const result = reader.decodeFromCanvas(canvas);
              if (result) handle(result.getText());
            }
          } catch {
            /* nada no quadro: tenta no próximo */
          }
          timer = setTimeout(tick, 120);
        };
        tick();
      } catch (err) {
        if (stopped) return;
        setStatus("error");
        setError(cameraErrorMessage(err));
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
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
            Aponte para o QR Code (ou o código de barras) da etiqueta, a uns 10–15 cm, com boa luz.
            Etiquetas com QR são lidas bem mais rápido pelo celular.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
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
