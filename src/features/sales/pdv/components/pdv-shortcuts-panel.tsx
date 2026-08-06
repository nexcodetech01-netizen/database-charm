import { memo, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Atalhos exibidos no diálogo do PDV (somente leitura). */
export const PDV_SHORTCUTS: { key: string; label: string }[] = [
  { key: "ENTER", label: "Adicionar" },
  { key: "F2", label: "Cliente" },
  { key: "F3", label: "Qtd" },
  { key: "F6", label: "Preço" },
  { key: "F7", label: "Desc Item" },
  { key: "F8", label: "Acrés Item" },
  { key: "F5", label: "Pagamento" },
  { key: "CTRL+S", label: "Suspender" },
  { key: "CTRL+R", label: "Recuperar" },
  { key: "CTRL+L", label: "Limpar" },
  { key: "DEL", label: "Remover" },
];

/**
 * PDVShortcutsDialog — botão discreto "Atalhos" (Sprint 3.1) que abre a lista
 * completa em diálogo. Puramente informativo: não registra nenhum listener
 * nem dispara ações; o mapa de teclas continua no hook de atalhos.
 */
export const PDVShortcutsDialog = memo(function PDVShortcutsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
        >
          <Keyboard className="mr-2 h-4 w-4" aria-hidden="true" />
          Atalhos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos do PDV</DialogTitle>
          <DialogDescription>
            Operação completa pelo teclado, sem tirar a mão do leitor.
          </DialogDescription>
        </DialogHeader>
        <ul aria-label="Atalhos do PDV" className="divide-y rounded-xl border">
          {PDV_SHORTCUTS.map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="text-sm">{s.label}</span>
              <kbd className="rounded border bg-muted px-2 py-1 font-mono text-[11px] font-semibold uppercase text-muted-foreground">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
});
