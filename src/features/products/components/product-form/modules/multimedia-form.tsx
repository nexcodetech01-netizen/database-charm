import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, X } from "lucide-react";
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
  onRemoveMainImage?: () => void | Promise<void>;
  removingMainImage?: boolean;
  uploadingVideo: boolean;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSuggestFromPhoto?: () => void;
  suggestingFromPhoto?: boolean;
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
  onRemoveMainImage,
  removingMainImage,
  uploadingVideo,
  onVideoUpload,
  onSuggestFromPhoto,
  suggestingFromPhoto,
}: MultimediaFormProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Imagem Principal</Label>
            {onSuggestFromPhoto && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onSuggestFromPhoto}
                disabled={!mainImageFile || suggestingFromPhoto}
                title={!mainImageFile ? "Selecione uma foto para poder sugerir" : undefined}
                className="h-7 gap-1 px-2 text-[10px]"
              >
                <Sparkles className={`h-3 w-3 ${suggestingFromPhoto ? "animate-spin" : ""}`} />
                Sugerir descrição e tags com a foto
              </Button>
            )}
          </div>
          <ProductMainImagePicker
            currentUrl={currentMainImageUrl}
            file={mainImageFile}
            onFileChange={setMainImageFile}
            onRemoveCurrent={onRemoveMainImage}
            disabled={uploadingMainImage || removingMainImage}
          />
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
