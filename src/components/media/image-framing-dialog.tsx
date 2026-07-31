import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Move, RotateCcw, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Framing } from "./framed-image";

interface ImageFramingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  initial?: Framing | null;
  title?: string;
  saving?: boolean;
  onSave: (framing: Required<Framing>) => Promise<void> | void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.05;

/**
 * Modal para ajuste manual do enquadramento da imagem.
 * - Container 1:1 com object-cover (preview idêntica ao render final).
 * - Arraste para deslocar (ajusta focal X/Y).
 * - Scroll ou slider para zoom.
 * - Salva focal_x, focal_y (0..100) e zoom (>=1) — nunca altera o arquivo.
 */
export function ImageFramingDialog({
  open,
  onOpenChange,
  imageUrl,
  initial,
  title = "Ajustar enquadramento",
  saving = false,
  onSave,
}: ImageFramingDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const [zoom, setZoom] = useState(1);

  // Recentraliza ao abrir ou trocar a imagem.
  useEffect(() => {
    if (!open) return;
    setFocalX(clamp(initial?.focal_x ?? 50, 0, 100));
    setFocalY(clamp(initial?.focal_y ?? 50, 0, 100));
    setZoom(clamp(initial?.zoom ?? 1, MIN_ZOOM, MAX_ZOOM));
  }, [open, imageUrl, initial]);

  const dragRef = useRef<{ startX: number; startY: number; fx: number; fy: number } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, fx: focalX, fy: focalY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !containerRef.current) return;
    const size = containerRef.current.getBoundingClientRect().width || 1;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Sensibilidade: 1px do container ≈ (100 / (size * zoom)) % de object-position.
    // Multiplicador 2 para dar sensação natural quando há bastante excesso a percorrer.
    const speed = 200 / (size * Math.max(zoom, 1));
    setFocalX((v) => clamp(dragRef.current!.fx - dx * speed, 0, 100));
    setFocalY((v) => clamp(dragRef.current!.fy - dy * speed, 0, 100));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => clamp(round(z + delta), MIN_ZOOM, MAX_ZOOM));
  }, []);

  const handleReset = () => {
    setFocalX(50);
    setFocalY(50);
    setZoom(1);
  };

  const handleSave = async () => {
    await onSave({
      focal_x: round(focalX),
      focal_y: round(focalY),
      zoom: round(zoom),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-4 w-4" /> {title}
          </DialogTitle>
          <DialogDescription>
            Arraste a imagem, use o scroll ou o controle de zoom para escolher
            exatamente como ela será exibida. O arquivo original não é alterado.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          className="relative mx-auto aspect-square w-full max-w-sm cursor-grab overflow-hidden rounded-xl border border-border bg-muted select-none touch-none active:cursor-grabbing"
          role="application"
          aria-label="Área de recorte"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: `${focalX}% ${focalY}%`,
                transform: `scale(${zoom})`,
                transformOrigin: `${focalX}% ${focalY}%`,
              }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              Sem imagem
            </div>
          )}

          {/* guias visuais */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 border border-white/20" />
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/15" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/15" />
            <div className="absolute top-1/3 left-0 h-px w-full bg-white/15" />
            <div className="absolute top-2/3 left-0 h-px w-full bg-white/15" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              onValueChange={([v]) =>
                setZoom(clamp(round(v ?? 1), MIN_ZOOM, MAX_ZOOM))
              }
              className="flex-1"
            />
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
              {zoom.toFixed(2)}x
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Move className="h-3.5 w-3.5" />
            Arraste dentro do quadro para reposicionar.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Centralizar
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !imageUrl}>
              {saving ? "Salvando…" : "Salvar enquadramento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
