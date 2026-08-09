import { Mic, MicOff, Loader2 } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect } from "react";

/**
 * Botão de ditado por voz — TESTE (Nível 1, grátis).
 *
 * Gating: visível SÓ para a conta admin de teste (VOICE_TEST_EMAIL). Nenhum
 * outro usuário/oficina vê. Quando aprovado, remover o gate de e-mail para
 * liberar geral.
 *
 * Só transcreve fala → chama onTranscript com o texto. Não estrutura nada.
 */

const VOICE_TEST_EMAIL = "ko.oliveira2016@gmail.com";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInputButton({ onTranscript, className }: VoiceInputButtonProps) {
  const { user } = useAuth();
  const { supported, listening, transcript, error, start, stop } = useVoiceInput(onTranscript);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Gate 1: só a conta de teste vê o botão.
  if (user?.email !== VOICE_TEST_EMAIL) return null;
  // Gate 2: se o navegador não suporta (iOS/Safari), esconde em vez de frustrar.
  if (!supported) return null;

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? "Parar ditado" : "Ditar por voz"}
        aria-pressed={listening}
        className={cn(
          "flex items-center justify-center gap-2 h-12 min-w-[48px] rounded-lg px-3 font-medium transition-colors",
          listening
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : "bg-primary text-primary-foreground",
          className,
        )}
      >
        {listening ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
            <span className="text-sm">Ouvindo… toque para parar</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-sm">Ditar</span>
          </>
        )}
      </button>
      {listening && transcript && (
        <p className="text-xs text-muted-foreground px-1 italic">"{transcript}"</p>
      )}
    </div>
  );
}
