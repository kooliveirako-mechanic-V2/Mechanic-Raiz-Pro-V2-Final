import * as React from "react";
import { useRef, useCallback, useState } from "react";
import { Button, ButtonProps } from "./button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão seguro com proteções built-in:
 * - Debounce de 500ms para prevenir duplo clique
 * - Estado de loading automático durante execução
 * - Desabilitação automática enquanto processa
 * - Touch targets grandes para mobile
 * 
 * BLINDAGEM: Proteção total contra erro de toque
 */

interface SafeButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Ação a executar (pode ser async) */
  onClick?: () => void | Promise<void>;
  /** Texto durante loading (opcional) */
  loadingText?: string;
  /** Delay de debounce em ms (default: 500) */
  debounceMs?: number;
  /** Se deve mostrar loader durante execução */
  showLoader?: boolean;
}

const SafeButton = React.forwardRef<HTMLButtonElement, SafeButtonProps>(
  (
    {
      onClick,
      loadingText,
      debounceMs = 500,
      showLoader = true,
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const [isPending, setIsPending] = useState(false);
    const lastClickRef = useRef<number>(0);
    const pendingRef = useRef<boolean>(false);

    const handleClick = useCallback(async () => {
      // Verificar debounce
      const now = Date.now();
      if (now - lastClickRef.current < debounceMs) {
        console.log("[SafeButton] Click bloqueado por debounce");
        return;
      }

      // Verificar se já está processando
      if (pendingRef.current) {
        console.log("[SafeButton] Click bloqueado - ação em andamento");
        return;
      }

      lastClickRef.current = now;

      if (!onClick) return;

      // Verificar se é async
      const result = onClick();
      
      if (result instanceof Promise) {
        pendingRef.current = true;
        setIsPending(true);
        
        try {
          await result;
        } finally {
          pendingRef.current = false;
          setIsPending(false);
        }
      }
    }, [onClick, debounceMs]);

    const isDisabled = disabled || isPending;

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          // Touch target mínimo de 44px para mobile
          "min-h-[44px] touch-manipulation",
          className
        )}
        {...props}
      >
        {isPending && showLoader ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

SafeButton.displayName = "SafeButton";

export { SafeButton };
