import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error;
  resetError: () => void;
}

export function SentryErrorFallback({ error, resetError }: Props) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
        <p className="text-muted-foreground text-sm">
          O erro foi registrado automaticamente. Nossa equipe será notificada.
        </p>
        <p className="text-xs text-muted-foreground/60 font-mono break-all">
          {error.message}
        </p>
        <Button onClick={resetError} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
