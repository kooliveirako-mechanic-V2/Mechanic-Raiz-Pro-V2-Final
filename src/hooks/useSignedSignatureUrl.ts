import { useEffect, useState } from "react";
import { getSignedSignatureUrl, isValidSignaturePath } from "@/lib/signedSignatureUrl";

/**
 * Hook que resolve um path do bucket `os-assinaturas` em signed URL.
 * Re-gera ao remontar/path mudar. Retorna null se path inválido ou falha.
 */
export function useSignedSignatureUrl(path: string | null | undefined): {
  url: string | null;
  loading: boolean;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    if (!isValidSignaturePath(path)) {
      setUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSignedSignatureUrl(path).then((signed) => {
      if (!active) return;
      setUrl(signed);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return { url, loading };
}
