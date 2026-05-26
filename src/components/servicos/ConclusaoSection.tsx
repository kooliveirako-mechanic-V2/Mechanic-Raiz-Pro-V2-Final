import { useState } from "react";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X, CheckCircle2, Loader2, ImagePlus, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateFile, safeFileName } from "@/lib/uploadValidation";

interface ConclusaoSectionProps {
  fotosSaida: string[];
  setFotosSaida: (value: string[]) => void;
  observacoesConclusao: string;
  setObservacoesConclusao: (value: string) => void;
  ordemId?: string;
  fotosEntrada?: string[];
}

export function ConclusaoSection({
  fotosSaida,
  setFotosSaida,
  observacoesConclusao,
  setObservacoesConclusao,
  ordemId,
  fotosEntrada = [],
}: ConclusaoSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newFotos: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const validation = validateFile(file, "image_or_video");
        if (!validation.ok) {
          toast.error(validation.error!);
          continue;
        }

        const fileName = safeFileName(file.name, "saida");
        const filePath = `${ordemId || "temp"}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("os-fotos")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erro ao fazer upload: ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("os-fotos")
          .getPublicUrl(filePath);

        if (urlData) {
          newFotos.push(urlData.publicUrl);
        }
      }

      if (newFotos.length > 0) {
        setFotosSaida([...fotosSaida, ...newFotos]);
        toast.success(`${newFotos.length} arquivo(s) de conclusão adicionado(s)!`);
      }
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const removeFoto = (index: number) => {
    const newFotos = fotosSaida.filter((_, i) => i !== index);
    setFotosSaida(newFotos);
  };

  return (
    <div className="space-y-4 p-4 md:p-5 bg-success/5 rounded-xl border border-success/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm md:text-base">
              Conclusão do Serviço
            </h3>
            <p className="text-xs text-muted-foreground">
              Registre o serviço finalizado
            </p>
          </div>
        </div>
        
        {fotosEntrada.length > 0 && fotosSaida.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowComparison(!showComparison);
            }}
            className="text-xs text-primary hover:underline"
          >
            {showComparison ? "Ocultar" : "Ver"} comparação
          </button>
        )}
      </div>

      {/* Comparação Antes/Depois */}
      {showComparison && fotosEntrada.length > 0 && fotosSaida.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-card rounded-lg border border-border">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Antes
            </span>
            <div className="grid grid-cols-2 gap-1">
              {fotosEntrada.slice(0, 4).map((foto, i) => (
                <img
                  key={i}
                  src={foto}
                  alt={`Antes ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-md"
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-medium text-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Depois
            </span>
            <div className="grid grid-cols-2 gap-1">
              {fotosSaida.slice(0, 4).map((foto, i) => (
                <img
                  key={i}
                  src={foto}
                  alt={`Depois ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-md"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Observações de Conclusão */}
      <div className="space-y-2">
        <Label className="text-sm">Observações da Conclusão</Label>
        <Textarea
          placeholder="Descreva o que foi feito, peças trocadas, observações para o cliente..."
          value={observacoesConclusao}
          onChange={(e) => setObservacoesConclusao(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Fotos de Conclusão */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-success" />
          <Label className="text-sm">Fotos e Vídeos de Conclusão</Label>
          {fotosSaida.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {fotosSaida.length} arquivo(s)
            </span>
          )}
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
          {fotosSaida.map((foto, index) => (
            <div key={index} className="relative group aspect-square">
              <MediaThumbnail
                src={foto}
                alt={`Foto conclusão ${index + 1}`}
                className="rounded-xl border border-success/30"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFoto(index);
                }}
                className="absolute -top-2 -right-2 min-w-[32px] min-h-[32px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Upload Button */}
          <label className="aspect-square border-2 border-dashed border-success/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-success hover:bg-success/5 active:bg-success/10 transition-all touch-manipulation">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-success" />
            ) : (
              <>
                <ImagePlus className="w-6 h-6 text-success" />
                <span className="text-[10px] md:text-xs text-success mt-1.5 text-center px-1">
                  Adicionar
                </span>
              </>
            )}
          </label>
        </div>

        {/* Helper text on mobile */}
        <p className="text-xs text-muted-foreground text-center sm:hidden">
          Toque para abrir a câmera e registrar fotos ou vídeos do serviço
        </p>
      </div>
    </div>
  );
}
