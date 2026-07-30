import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { useSignedFotoUrl } from "@/hooks/useSignedFotoUrls";

interface FotoOSProps {
  foto: string | null | undefined;
  alt: string;
  className?: string;
}

/** <img> de foto de OS resolvida via signed URL (bucket privado). */
export function FotoOSImg({ foto, alt, className }: FotoOSProps) {
  const src = useSignedFotoUrl(foto);
  if (!src) {
    return <div className={className ? `${className} bg-muted animate-pulse` : "bg-muted animate-pulse"} />;
  }
  return <img src={src} alt={alt} className={className} />;
}

/** Thumbnail (imagem ou vídeo) de foto de OS via signed URL. */
export function FotoOSThumb({ foto, alt, className }: FotoOSProps) {
  const src = useSignedFotoUrl(foto);
  if (!src) {
    return <div className={className ? `${className} w-full h-full bg-muted animate-pulse` : "w-full h-full bg-muted animate-pulse"} />;
  }
  return <MediaThumbnail src={src} alt={alt} className={className} />;
}
