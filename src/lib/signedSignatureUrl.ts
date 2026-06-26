/**
 * Helper para gerar signed URL do bucket `os-assinaturas`.
 *
 * Regras (B2):
 * - aceita somente path relativo
 * - rejeita string vazia, http, /storage/v1/object/public/, ..
 * - aceita <uuid>/assinatura-*.png e temp/assinatura-*.png
 * - createSignedUrl(path, 600)
 * - retorna null em erro controlado
 * - não usa service role
 * - não loga path completo nem URL assinada completa
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "os-assinaturas";
const EXPIRES_IN = 600; // 10 min

const VALID_PATH = /^(temp|[0-9a-f-]{8,})\/assinatura-[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp)$/i;

function maskPath(path: string): string {
  if (!path) return "<empty>";
  const head = path.slice(0, 8);
  return `${head}***`;
}

export function isValidSignaturePath(path: string | null | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
  if (trimmed.includes("/storage/v1/object/public/")) return false;
  if (trimmed.includes("..")) return false;
  return VALID_PATH.test(trimmed);
}

export async function getSignedSignatureUrl(
  path: string | null | undefined,
  expiresIn: number = EXPIRES_IN
): Promise<string | null> {
  if (!isValidSignaturePath(path)) {
    if (path) console.warn("[signature] path inválido:", maskPath(String(path)));
    return null;
  }
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      console.warn("[signature] falha ao gerar signed URL para", maskPath(path));
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn("[signature] erro inesperado em createSignedUrl", maskPath(path));
    return null;
  }
}
