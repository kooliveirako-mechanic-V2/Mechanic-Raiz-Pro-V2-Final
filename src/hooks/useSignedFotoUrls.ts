import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSignedFotoUrl } from "@/lib/storage/fotos";

const TTL_SECONDS = 600; // igual ao default de getSignedFotoUrl
const REFRESH_RATIO = 0.8; // re-assina a 80% do TTL (480s), antes de expirar
const REFRESH_MS = TTL_SECONDS * REFRESH_RATIO * 1000;

interface CacheEntry {
  url: string;
  signedAt: number;
}

/**
 * Resolve uma lista de fotos de OS (paths relativos, URLs legadas ou blob:)
 * em URLs assinadas. Retorna um resolver síncrono para uso em `src={}`.
 *
 * Enquanto a assinatura não chega, devolve "" (evita vazar URL pública).
 *
 * A assinatura é RENOVADA automaticamente a 80% do TTL enquanto o componente
 * estiver montado — sem isso, uma tela aberta por mais de 10 min passaria a
 * exibir imagem quebrada (403) quando a URL expirasse.
 */
export function useSignedFotoUrls(fotos: Array<string | null | undefined>) {
  const key = useMemo(() => JSON.stringify(fotos ?? []), [fotos]);
  const [map, setMap] = useState<Record<string, string>>({});
  const cache = useRef<Record<string, CacheEntry>>({});

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const signPending = async () => {
      const list = (JSON.parse(key) as Array<string | null>).filter(
        (v): v is string => !!v && v.trim() !== ""
      );

      const now = Date.now();
      const stale = list.filter((v) => {
        const entry = cache.current[v];
        return !entry || now - entry.signedAt >= REFRESH_MS;
      });

      if (stale.length > 0) {
        const pairs = await Promise.all(
          stale.map(async (v) => [v, await getSignedFotoUrl(v, TTL_SECONDS)] as const)
        );
        if (!active) return;
        for (const [k, url] of pairs) {
          if (url) cache.current[k] = { url, signedAt: Date.now() };
        }
      }

      if (!active) return;

      const next: Record<string, string> = {};
      for (const v of list) {
        const entry = cache.current[v];
        if (entry) next[v] = entry.url;
      }
      setMap(next);

      // Reagenda a renovação enquanto a tela continuar aberta.
      timer = window.setTimeout(signPending, REFRESH_MS);
    };

    void signPending();

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [key]);

  return useCallback(
    (foto: string | null | undefined): string => {
      if (!foto) return "";
      if (foto.startsWith("blob:") || foto.startsWith("data:")) return foto;
      return map[foto] ?? "";
    },
    [map]
  );
}

/** Versão para uma única foto. */
export function useSignedFotoUrl(foto: string | null | undefined): string {
  const resolve = useSignedFotoUrls(foto ? [foto] : []);
  return resolve(foto);
}
