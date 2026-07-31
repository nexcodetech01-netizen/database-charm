import { useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2, Crop } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { productImagesService } from "../services/product-images.service";
import { useProductImages, useSignedImageUrls } from "../hooks/use-products";
import { useQueryClient } from "@tanstack/react-query";
import { productsKeys } from "../hooks/use-products";
import { FramedImage, type Framing } from "@/components/media/framed-image";
import { ImageFramingDialog } from "@/components/media/image-framing-dialog";
import type { ProductImage } from "../types";

interface Props {
  companyId: string;
  productId: string;
}

const MAX_MB = 5;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ProductImageUploader({ companyId, productId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const { data: images = [] } = useProductImages(productId);
  const paths = images.map((i) => i.path);
  const { data: signed = [] } = useSignedImageUrls(paths);
  const urlMap = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const [framingImage, setFramingImage] = useState<ProductImage | null>(null);
  const [framingSaving, setFramingSaving] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const createdOrder: ProductImage[] = [];
    try {
      let pos = images.length;
      for (const file of Array.from(files)) {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`Formato não suportado: ${file.name}`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name} excede ${MAX_MB}MB`);
          continue;
        }
        const path = await productImagesService.upload(companyId, productId, file);
        const rec = (await productImagesService.createRecord(
          companyId,
          productId,
          path,
          pos++,
        )) as ProductImage;
        createdOrder.push(rec);
      }
      await qc.invalidateQueries({ queryKey: productsKeys.images(productId) });
      if (createdOrder.length > 0) {
        toast.success(
          createdOrder.length === 1
            ? "Imagem enviada — ajuste o enquadramento"
            : `${createdOrder.length} imagens enviadas`,
        );
        // Abrir cropper para a primeira imagem enviada.
        setFramingImage(createdOrder[0]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (id: string, path: string) => {
    try {
      await productImagesService.remove(id, path);
      await qc.invalidateQueries({ queryKey: productsKeys.images(productId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  };

  const saveFraming = async (framing: Required<Framing>) => {
    if (!framingImage) return;
    setFramingSaving(true);
    try {
      await productImagesService.updateFraming(framingImage.id, {
        focal_x: Number(framing.focal_x ?? 50),
        focal_y: Number(framing.focal_y ?? 50),
        zoom: Number(framing.zoom ?? 1),
      });
      await qc.invalidateQueries({ queryKey: productsKeys.images(productId) });
      await qc.invalidateQueries({ queryKey: productsKeys.detail(productId) });
      toast.success("Enquadramento salvo");
      setFramingImage(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setFramingSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">Arraste ou clique para enviar</p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WEBP · até {MAX_MB}MB · múltiplos arquivos
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => {
            const url = urlMap.get(img.path);
            return (
              <div key={img.id} className="group relative">
                <FramedImage
                  src={url}
                  framing={img}
                  aspect="square"
                  rounded="lg"
                  containerClassName="border border-border"
                  fallback={<ImageIcon className="h-6 w-6 text-muted-foreground" />}
                />
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-1 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="pointer-events-auto h-7 w-7"
                    title="Ajustar enquadramento"
                    onClick={() => setFramingImage(img)}
                  >
                    <Crop className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="pointer-events-auto h-7 w-7"
                    title="Remover"
                    onClick={() => handleRemove(img.id, img.path)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <ImageFramingDialog
        open={!!framingImage}
        onOpenChange={(o) => !o && setFramingImage(null)}
        imageUrl={framingImage ? (urlMap.get(framingImage.path) ?? null) : null}
        initial={
          framingImage
            ? {
                focal_x: Number(framingImage.focal_x ?? 50),
                focal_y: Number(framingImage.focal_y ?? 50),
                zoom: Number(framingImage.zoom ?? 1),
              }
            : null
        }
        saving={framingSaving}
        onSave={saveFraming}
      />
    </div>
  );
}
