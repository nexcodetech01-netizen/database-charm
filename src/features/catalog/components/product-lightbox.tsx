import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: { url: string; path: string }[];
  index: number;
  onIndexChange: (index: number) => void;
  alt: string;
}

export function ProductLightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndexChange,
  alt,
}: ProductLightboxProps) {
  const [zoom, setZoom] = useState(false);

  const total = images.length;

  const prev = useCallback(() => {
    if (total < 2) return;
    onIndexChange((index - 1 + total) % total);
    setZoom(false);
  }, [index, total, onIndexChange]);

  const next = useCallback(() => {
    if (total < 2) return;
    onIndexChange((index + 1) % total);
    setZoom(false);
  }, [index, total, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "+" || e.key === "=") setZoom(true);
      else if (e.key === "-") setZoom(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, prev, next]);

  useEffect(() => {
    if (!open) setZoom(false);
  }, [open]);

  const current = images[index];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-none bg-black/95 p-0 [&>button]:text-white [&>button]:opacity-100 sm:rounded-lg">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative flex h-[85vh] w-full items-center justify-center overflow-hidden">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            className={cn(
              "flex h-full w-full items-center justify-center overflow-auto",
              zoom ? "cursor-zoom-out" : "cursor-zoom-in",
            )}
            aria-label={zoom ? "Reduzir zoom" : "Ampliar imagem"}
          >
            <img
              src={current.url}
              alt={alt}
              draggable={false}
              className={cn(
                "select-none transition-transform duration-200",
                zoom
                  ? "max-w-none scale-[2] cursor-zoom-out"
                  : "max-h-[85vh] max-w-full object-contain",
              )}
            />
          </button>

          {total > 1 && (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Imagem anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Próxima imagem"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          <div className="absolute right-3 top-3 flex gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => !z);
              }}
              aria-label={zoom ? "Reduzir zoom" : "Ampliar"}
              className="rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              {zoom ? (
                <ZoomOut className="h-4 w-4" />
              ) : (
                <ZoomIn className="h-4 w-4" />
              )}
            </Button>
          </div>


          {total > 1 && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">
              {index + 1} / {total}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
