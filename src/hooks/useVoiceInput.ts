import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVoiceInput — ditado por voz via Web Speech API NATIVA do navegador.
 *
 * Nível 1 (grátis): transcreve fala → texto. Zero custo de IA, zero servidor,
 * nenhuma chave. Usa SpeechRecognition (Android/Chrome funciona bem; iOS/Safari
 * é limitado — por isso `supported` é exposto para esconder o botão onde não dá).
 *
 * Não decide nada, não estrutura campos — só devolve o texto falado para o
 * caller colocar onde quiser. pt-BR fixo.
 */

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : unknown;

interface UseVoiceInputResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useVoiceInput(onFinalText?: (text: string) => void): UseVoiceInputResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Detecta a API do navegador (com prefixo webkit no Chrome/Android).
  const SpeechRecognition =
    typeof window !== "undefined"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;

  const supported = Boolean(SpeechRecognition);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("Seu navegador não suporta ditado por voz. Use o Chrome no Android.");
      return;
    }
    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false; // uma frase por vez — mecânico fala e para
    recognition.interimResults = true; // feedback em tempo real enquanto fala

    recognition.onresult = (event: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setTranscript(full);
      // Quando o resultado é final, entrega ao caller.
      if (e.results[e.results.length - 1].isFinal) {
        onFinalRef.current?.(full.trim());
      }
    };

    recognition.onerror = (event: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Permissão de microfone negada. Libere o microfone para o site.");
      } else if (e.error === "no-speech") {
        setError("Não ouvi nada. Toque no microfone e fale de novo.");
      } else {
        setError("Não consegui capturar o áudio. Tente novamente.");
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [SpeechRecognition, supported]);

  // Limpa o reconhecimento se o componente desmontar no meio da fala.
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore — já parado
        }
      }
    };
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
