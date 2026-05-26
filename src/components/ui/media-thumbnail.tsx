import { Play } from "lucide-react";

function isVideo(url: string): boolean {
  const videoExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.3gp'];
  const lower = url.toLowerCase();
  return videoExts.some(ext => lower.includes(ext));
}

interface MediaThumbnailProps {
  src: string;
  alt: string;
  className?: string;
}

export function MediaThumbnail({ src, alt, className = "" }: MediaThumbnailProps) {
  if (isVideo(src)) {
    return (
      <div className={`relative ${className}`}>
        <video
          src={src}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          onLoadedData={(e) => {
            // Seek to 1s for thumbnail
            (e.target as HTMLVideoElement).currentTime = 1;
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-foreground fill-foreground ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

export { isVideo };
