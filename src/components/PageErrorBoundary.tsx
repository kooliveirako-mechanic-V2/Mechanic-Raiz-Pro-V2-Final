import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary para páginas internas.
 * Evita tela branca ao capturar erros em hooks/componentes filhos.
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Erro ao carregar página
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Algo deu errado ao carregar esta seção. Tente novamente ou volte ao início.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
            <Button size="sm" onClick={() => window.location.assign("/")}>
              Voltar ao início
            </Button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 text-xs text-left bg-muted p-3 rounded max-w-lg overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
