import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve foto value to public URL.
 * Handles both legacy format (full public URL) and normalized format (relative path).
 * Returns empty string for null/undefined/empty inputs.
 */
export function resolveFotoUrl(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const { data } = supabase.storage.from("os-fotos").getPublicUrl(value);
  return data.publicUrl;
}
