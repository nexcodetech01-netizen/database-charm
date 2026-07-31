import { useState } from "react";
import { Archive, Bot, CheckCircle2, HandMetal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ConversationDetail } from "./types";

export function ConversationActions({
  conversation,
  onAssume,
  onReturn,
  onArchive,
  onResolve,
  onDelete,
  busy,
  deleting,
}: {
  conversation: ConversationDetail;
  onAssume: () => void;
  onReturn: () => void;
  onArchive: () => void;
  onResolve: () => void;
  onDelete: () => void;
  busy?: boolean;
  deleting?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isHuman = conversation.status === "human";
  const isResolved = conversation.status === "resolved";
  const isArchived = conversation.status === "archived";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isHuman ? (
        <Button size="sm" variant="outline" onClick={onReturn} disabled={busy}>
          <Bot className="mr-1.5 h-3.5 w-3.5" /> Devolver para Bella
        </Button>
      ) : (
        <Button size="sm" onClick={onAssume} disabled={busy || isArchived}>
          <HandMetal className="mr-1.5 h-3.5 w-3.5" /> Assumir
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onResolve} disabled={busy || isResolved}>
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolver
      </Button>
      <Button size="sm" variant="ghost" onClick={onArchive} disabled={busy || isArchived}>
        <Archive className="mr-1.5 h-3.5 w-3.5" /> Arquivar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        disabled={busy || deleting}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Excluir conversa"
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens e o histórico desta conversa serão apagados
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                onDelete();
                setConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
