import { useEffect, useMemo, useRef, useState } from "react";
import { getSignedFotoUrl } from "@/lib/storage/fotos";

/**
 * Resolve uma lista de fotos de OS (paths relativos, URLs legadas ou blob:)
 * em URLs assinadas. Retorna um resolver síncrono para uso em `src={}`.
 *
 * Enquanto a assinatura não chega, devolve "" (evita vazar URL pública).
 */
export function useSignedFotoUrls(fotos: Array<string | null | undefined>) {
  const key = useMemo(() => JSON.stringify(fotos ?? []), [fotos]);
  const [map, setMap] = useState<Record<string, string>>({});
  const cache = useRef<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const list = (JSON.parse(key) as Array<string | null>).filter(
      (v): v is string => !!v && v.trim() !== ""
    );
    const pending = list.filter((v) => !cache.current[v]);
    if (pending.length === 0) {
      setMap({ ...cache.current });
      return;
    }

    Promise.all(
      pending.map(async (v) => [v, await getSignedFotoUrl(v)] as const)
    ).then((pairs) => {
      if (!active) return;
      for (const [k, url] of pairs) {
        if (url) cache.current[k] = url;
      }
      setMap({ ...cache.current });
    });

    return () => {
      active = false;
    };
  }, [key]);

  return (foto: string | null | undefined): string => {
    if (!foto) return "";
    if (foto.startsWith("blob:") || foto.startsWith("data:")) return foto;
    return map[foto] ?? "";
  };
}

/** Versão para uma única foto. */
export function useSignedFotoUrl(foto: string | null | undefined): string {
  const resolve = useSignedFotoUrls(foto ? [foto] : []);
  return resolve(foto);
}
