import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, X, Upload, Smartphone, Globe, Loader2 } from "lucide-react";
import { ProductImageUploader } from "../../product-image-uploader";
import { ProductMainImagePicker } from "../../product-main-image-picker";
import { SALES_CHANNEL_OPTIONS } from "../../../types";

interface MultimediaFormProps {
  companyId: string;
  productId?: string;
  form: any;
  setForm: (val: any) => void;
  mainImageFile: File | null;
  setMainImageFile: (file: File | null) => void;
  uploadingMainImage?: boolean;
  currentMainImageUrl: string | null;
  uploadingVideo: boolean;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function MultimediaForm({
  companyId,
  productId,
  form,
  setForm,
  mainImageFile,
  setMainImageFile,
  uploadingMainImage,
  currentMainImageUrl,
  uploadingVideo,
  onVideoUpload,
}: MultimediaFormProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <Label className="text-base font-semibold">Imagem Principal</Label>
          <div className="aspect-square max-w-[300px] relative rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center overflow-hidden">
            {uploadingMainImage ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                <p className="text-xs font-medium text-muted-foreground">Enviando imagem...</p>
              </div>
            ) : mainImageFile || currentMainImageUrl ? (
              <>
                <img
                  src={mainImageFile ? URL.createObjectURL(mainImageFile) : currentMainImageUrl!}
                  alt="Preview"
                  className="h-full w-full object-contain p-2"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={() => {
                    setMainImageFile(null);
                    // Nota: a remoção física no bucket acontece no save do form principal
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="text-center p-6 space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground font-medium">Clique para selecionar</p>
                <p className="text-[10px] text-muted-foreground/60">PNG, JPG ou WEBP (Max 5MB)</p>
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={(e) => setMainImageFile(e.target.files?.[0] || null)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Video className="h-4 w-4" />
              Vídeo Demonstrativo
            </Label>
            <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
              {form.video_url ? (
                <div className="space-y-3">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                    <video src={form.video_url} controls className="max-h-full" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 rounded-full"
                      onClick={() => setForm((s: any) => ({ ...s, video_url: "" }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground break-all">{form.video_url}</p>
                </div>
              ) : (
                <div className="relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors hover:border-primary/40 group">
                  <Video className="h-8 w-8 text-muted-foreground/40 mb-2 group-hover:text-primary/40 transition-colors" />
                  <p className="text-xs font-medium text-muted-foreground">Adicionar vídeo do produto</p>
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="video/*"
                    onChange={onVideoUpload}
                    disabled={uploadingVideo}
                  />
                  {uploadingVideo && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                        Enviando...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Canais de Venda</Label>
            <div className="grid grid-cols-2 gap-3">
              {SALES_CHANNEL_OPTIONS.map((channel) => {
                const isSelected = form.sales_channels.includes(channel.value);
                return (
                  <button
                    key={channel.value}
                    type="button"
                    onClick={() => {
                      const current = [...form.sales_channels];
                      if (isSelected) {
                        setForm((s: any) => ({
                          ...s,
                          sales_channels: current.filter((v) => v !== channel.value),
                        }));
                      } else {
                        setForm((s: any) => ({
                          ...s,
                          sales_channels: [...current, channel.value],
                        }));
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-primary/5 border-primary text-primary ring-1 ring-primary/20"
                        : "bg-background border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    {channel.value === "loja_fisica" ? (
                      <Smartphone className="h-4 w-4 shrink-0" />
                    ) : channel.value === "mercadolivre" ? (
                      <Globe className="h-4 w-4 shrink-0" />
                    ) : (
                      <Smartphone className="h-4 w-4 shrink-0 rotate-180" />
                    )}
                    <span className="text-xs font-medium">{channel.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {productId && (
        <div className="space-y-4 pt-4 border-t">
          <Label className="text-base font-semibold">Galeria de Fotos Completa</Label>
          <ProductImageUploader productId={productId} companyId={companyId} />
        </div>
      )}
    </div>
  );
}
