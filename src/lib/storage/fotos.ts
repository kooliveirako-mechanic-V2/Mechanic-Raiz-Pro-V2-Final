import { supabase } from "@/integrations/supabase/client";

const BUCKET = "os-fotos";
const DEFAULT_EXPIRES_IN = 600; // 10 min

/**
 * Resolve foto value to public URL.
 * DEPRECATED: só funciona enquanto o bucket `os-fotos` for público.
 * Use `getSignedFotoUrl` / `useSignedFotoUrls` — este helper é mantido
 * apenas como fallback de compatibilidade.
 */
export function resolveFotoUrl(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(value);
  return data.publicUrl;
}

/**
 * Extrai o path relativo dentro do bucket `os-fotos` a partir de qualquer
 * um dos formatos que existem na base:
 *  1) path relativo: `<uuid>/entrada-....jpg` ou `temp/....jpg`
 *  2) URL pública legada: `https://<host>/storage/v1/object/public/os-fotos/<path>`
 *  3) URL assinada legada: `.../object/sign/os-fotos/<path>?token=...`
 * Retorna null para `blob:`, vazio ou URL externa (não é do bucket).
 */
export function toFotoPath(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.startsWith("blob:") || v.includes("..")) return null;

  if (v.startsWith("http://") || v.startsWith("https://")) {
    const match = v.match(/\/storage\/v1\/object\/(?:public|sign)\/os-fotos\/(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1].split("?")[0]);
  }

  return v.replace(/^\/+/, "");
}

/**
 * Gera signed URL para uma foto de OS. Funciona com bucket privado.
 * - `blob:` (preview local) passa direto
 * - URL externa (não-bucket) passa direto
 * - falha controlada → string vazia
 */
export async function getSignedFotoUrl(
  value: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<string> {
  if (!value || value.trim() === "") return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const path = toFotoPath(value);
  if (!path) {
    // URL externa que não pertence ao bucket: mantém comportamento atual
    return value.startsWith("http") ? value : "";
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      console.warn("[os-fotos] falha ao assinar URL:", error?.message);
      return "";
    }
    return data.signedUrl;
  } catch (err) {
    console.warn("[os-fotos] erro inesperado ao assinar URL");
    return "";
  }
}

/** Assina várias fotos de uma vez, preservando a ordem. */
export async function getSignedFotoUrls(
  values: Array<string | null | undefined>,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<string[]> {
  return Promise.all(values.map((v) => getSignedFotoUrl(v, expiresIn)));
}
