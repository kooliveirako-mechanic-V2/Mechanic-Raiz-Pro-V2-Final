/**
 * Validação centralizada de uploads de arquivos.
 *
 * Estratégia conservadora:
 * - Bloqueia o que é claramente errado (tipo/extensão/tamanho).
 * - Gera nome de arquivo seguro (random) para evitar path-traversal e colisões.
 * - NÃO faz magic-bytes check aqui (pode ser adicionado depois sem mudar a API).
 *
 * O bucket no Supabase já tem `allowed_mime_types` e `file_size_limit`
 * como segunda camada — qualquer coisa que escape daqui é barrada lá.
 */

export const IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
] as const;

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"] as const;
export const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v"] as const;

export const SIZE_10MB = 10 * 1024 * 1024;
export const SIZE_50MB = 50 * 1024 * 1024;
export const SIZE_2MB = 2 * 1024 * 1024;

export type UploadKind = "image" | "video" | "image_or_video" | "logo" | "csv";

export interface UploadValidationResult {
  ok: boolean;
  error?: string;
  /** Limite de tamanho aplicado (para a mensagem) */
  maxSize?: number;
}

/**
 * Extrai a extensão de forma segura, em minúsculas.
 * Retorna `""` se não houver ou se tiver caracteres suspeitos.
 */
export function getSafeExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) return "";
  const ext = fileName.slice(lastDot + 1).toLowerCase();
  // só aceita alfanumérico curto
  if (!/^[a-z0-9]{1,5}$/.test(ext)) return "";
  return ext;
}

/**
 * Gera um nome de arquivo seguro: prefixo opcional + UUID + extensão validada.
 * Nunca usa o nome original do usuário no path final.
 */
export function safeFileName(originalName: string, prefix = ""): string {
  const ext = getSafeExtension(originalName);
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
  return `${safePrefix ? safePrefix + "-" : ""}${uuid}${ext ? "." + ext : ""}`;
}

/**
 * Valida um File de acordo com o tipo de upload esperado.
 * Mensagens em PT-BR prontas para `toast.error()`.
 */
export function validateFile(file: File, kind: UploadKind): UploadValidationResult {
  // 1. Tamanho
  let maxSize: number;
  switch (kind) {
    case "video":
      maxSize = SIZE_50MB;
      break;
    case "image_or_video":
      maxSize = file.type.startsWith("video/") ? SIZE_50MB : SIZE_10MB;
      break;
    case "logo":
      maxSize = SIZE_2MB;
      break;
    case "csv":
      maxSize = 5 * 1024 * 1024; // 5MB CSV
      break;
    case "image":
    default:
      maxSize = SIZE_10MB;
  }

  if (file.size > maxSize) {
    const mb = Math.round(maxSize / (1024 * 1024));
    return {
      ok: false,
      error: `"${file.name}" é muito grande (máx ${mb}MB)`,
      maxSize,
    };
  }

  // 2. MIME + extensão
  const ext = getSafeExtension(file.name);
  const mime = (file.type || "").toLowerCase();

  const isImage =
    IMAGE_MIMES.includes(mime as (typeof IMAGE_MIMES)[number]) ||
    IMAGE_EXTS.includes(ext as (typeof IMAGE_EXTS)[number]);
  const isVideo =
    VIDEO_MIMES.includes(mime as (typeof VIDEO_MIMES)[number]) ||
    VIDEO_EXTS.includes(ext as (typeof VIDEO_EXTS)[number]);

  switch (kind) {
    case "image":
    case "logo":
      if (!isImage) {
        return { ok: false, error: `"${file.name}" não é uma imagem válida` };
      }
      break;
    case "video":
      if (!isVideo) {
        return { ok: false, error: `"${file.name}" não é um vídeo válido` };
      }
      break;
    case "image_or_video":
      if (!isImage && !isVideo) {
        return { ok: false, error: `"${file.name}" não é uma foto ou vídeo válido` };
      }
      break;
    case "csv":
      if (!["csv", "txt"].includes(ext) && !mime.includes("csv") && !mime.includes("text")) {
        return { ok: false, error: `"${file.name}" não é um CSV válido` };
      }
      break;
  }

  return { ok: true };
}
