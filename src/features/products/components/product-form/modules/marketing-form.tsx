import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Plus } from "lucide-react";

interface MarketingFormProps {
  form: any;
  setForm: (val: any) => void;
  tagInput: string;
  setTagInput: (val: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  suggestedTags: string[];
  suggestingTags: boolean;
  onSuggestTags: () => void;
}

export function MarketingForm({
  form,
  setForm,
  tagInput,
  setTagInput,
  onAddTag,
  onRemoveTag,
  suggestedTags,
  suggestingTags,
  onSuggestTags,
}: MarketingFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Tags e Palavras-chave</Label>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onSuggestTags}
            disabled={suggestingTags}
            className="h-7 text-[10px] gap-1 px-2"
          >
            <Sparkles className={`h-3 w-3 ${suggestingTags ? "animate-spin" : ""}`} />
            Sugerir com IA
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2 p-3 rounded-md border min-h-[46px] bg-muted/20">
          {form.tags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              {tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {form.tags.length === 0 && (
            <span className="text-xs text-muted-foreground italic">Nenhuma tag adicionada...</span>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Nova tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddTag();
              }
            }}
          />
          <Button type="button" onClick={onAddTag} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {suggestedTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">Sugestões:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags
                .filter((t) => !form.tags.includes(t))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setForm((s: any) => ({ ...s, tags: [...s.tags, tag] }))}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-dashed hover:border-solid hover:bg-accent transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand">Marca</Label>
        <Input
          id="brand"
          placeholder="Ex: Nike, Samsung, Genérica"
          value={form.brand}
          onChange={(e) => setForm((s: any) => ({ ...s, brand: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Modelo</Label>
        <Input
          id="model"
          placeholder="Ex: Air Max, Galaxy S24"
          value={form.model}
          onChange={(e) => setForm((s: any) => ({ ...s, model: e.target.value }))}
        />
      </div>
    </div>
  );
}
