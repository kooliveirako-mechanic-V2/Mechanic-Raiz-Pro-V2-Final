import { FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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

/**
 * BLINDAGEM UX: Diálogo de confirmação de retomada de rascunho.
 *
 * Substitui a restauração AUTOMÁTICA de rascunhos do useAutoSave.
 * Antes: ao abrir uma nova OS/Orçamento, o formulário era preenchido
 * silenciosamente com dados de outro cliente/rascunho — causando
 * confusão e risco de faturar OS errada (caso Moisés/Luciano #1422).
 *
 * Agora: usuário decide explicitamente se retoma ou começa em branco.
 */

interface DraftPromptDialogProps {
  open: boolean;
  label: string; // ex: "ordem de serviço", "orçamento"
  savedAt?: Date | null;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftPromptDialog({
  open,
  label,
  savedAt,
  onResume,
  onDiscard,
}: DraftPromptDialogProps) {
  const when = savedAt
    ? formatDistanceToNow(savedAt, { addSuffix: true, locale: ptBR })
    : "há pouco";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center mb-2">
            <FileText className="w-5 h-5 text-warning" />
          </div>
          <AlertDialogTitle>Rascunho encontrado</AlertDialogTitle>
          <AlertDialogDescription>
            Existe um {label} não finalizado salvo {when}. O que você quer fazer?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onDiscard}>
            Começar em branco
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume}>
            Retomar rascunho
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
