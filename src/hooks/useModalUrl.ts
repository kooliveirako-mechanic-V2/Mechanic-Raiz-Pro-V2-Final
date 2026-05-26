import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Persists modal open/close state via URL search params.
 * 
 * When user switches apps (e.g. goes to WhatsApp) and returns,
 * the URL param is still present → modal stays open.
 * 
 * Usage:
 *   const [osRapidaOpen, setOsRapidaOpen] = useModalUrl("os-rapida");
 *   <OSRapidaModal open={osRapidaOpen} onOpenChange={setOsRapidaOpen} />
 */
export function useModalUrl(paramName: string): [boolean, (open: boolean) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const isOpen = useMemo(
    () => searchParams.get("modal") === paramName,
    [searchParams, paramName]
  );

  const setOpen = useCallback(
    (open: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (open) {
          next.set("modal", paramName);
        } else {
          // Only remove if this modal owns the param
          if (next.get("modal") === paramName) {
            next.delete("modal");
          }
        }
        return next;
      }, { replace: true });
    },
    [paramName, setSearchParams]
  );

  return [isOpen, setOpen];
}
