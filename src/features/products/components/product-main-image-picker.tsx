import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 2;

interface Props {
  /** URL da imagem principal já persistida (assinada), quando existir. */
  currentUrl: string | null;
  /** Arquivo pendente ainda não enviado. */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Chamado quando o usuário remove uma imagem já persistida. */
  onRemoveCurrent?: () => void | Promise<void>;
  disabled?: boolean;
}

/**
 * Seletor da imagem principal do produto.
 * - Sem produto: mantém o File em memória e o expõe ao formulário via `onFileChange`.
 * - Com produto: mostra a imagem atual e permite trocar/remover.
 * Persistência é responsabilidade do formulário (após criar/atualizar o produto).
 */
export function ProductMainImagePicker({
  currentUrl,
  file,
  onFileChange,
  onRemoveCurrent,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removingCurrent, setRemovingCurrent] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayUrl = preview ?? currentUrl;

  const openPicker = () => inputRef.current?.click();

  const handleSelect = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Formato inválido. Envie PNG, JPG ou WEBP.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Imagem excede ${MAX_MB} MB.`);
      return;
    }
    onFileChange(f);
  };

  const handleRemove = async () => {
    if (file) {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (currentUrl && onRemoveCurrent) {
      try {
        setRemovingCurrent(true);
        await onRemoveCurrent();
      } finally {
        setRemovingCurrent(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="group relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={displayUrl ? "Trocar imagem" : "Adicionar foto do produto"}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Imagem do produto" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs font-medium">Adicionar foto do produto</span>
          </div>
        )}
      </button>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled}>
            {displayUrl ? "Trocar imagem" : "Selecionar imagem"}
          </Button>
          {(file || currentUrl) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || removingCurrent}
              className="text-destructive hover:text-destructive"
            >
              {removingCurrent ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Remover
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG ou WEBP · até {MAX_MB} MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          handleSelect(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
