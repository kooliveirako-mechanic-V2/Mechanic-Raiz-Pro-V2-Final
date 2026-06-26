import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PenTool, Trash2, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSignedSignatureUrl } from "@/hooks/useSignedSignatureUrl";

interface SignaturePadProps {
  /** URL legada (assinatura_cliente_url) — usada como fallback de exibição. */
  assinaturaUrl: string | null;
  /** Setter da URL legada — usado para limpar/preservar compatibilidade. */
  onAssinaturaChange: (url: string | null) => void;
  /** Path novo (assinatura_cliente_path) — preferido para exibição via signed URL. */
  assinaturaPath?: string | null;
  /** Setter do novo path. */
  onPathChange?: (path: string | null) => void;
  ordemId?: string;
  disabled?: boolean;
}

export function SignaturePad({
  assinaturaUrl,
  onAssinaturaChange,
  assinaturaPath,
  onPathChange,
  ordemId,
  disabled,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Signed URL para o path (preferida sobre a URL legada)
  const { url: signedUrl } = useSignedSignatureUrl(assinaturaPath ?? null);

  // Fonte de exibição: 1) preview local recém-salvo, 2) signed URL do path, 3) URL legada
  const displayUrl = localPreviewUrl || signedUrl || assinaturaUrl;

  // Auto-open se já há assinatura
  useEffect(() => {
    if (assinaturaUrl || assinaturaPath) setIsOpen(true);
  }, [assinaturaUrl, assinaturaPath]);

  // Revoga blob URL local ao desmontar / trocar
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const getCanvasCoords = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    lastPos.current = coords;
    setIsDrawing(true);
    setHasSignature(true);
  }, [disabled, getCanvasCoords]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPos.current) return;

    const coords = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = coords;
  }, [isDrawing, disabled, getCanvasCoords]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    onAssinaturaChange(null);
    onPathChange?.(null);
  }, [onAssinaturaChange, onPathChange, localPreviewUrl]);

  const saveSignature = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    setIsSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Falha ao gerar imagem");

      const fileName = `${ordemId || "temp"}/assinatura-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("os-assinaturas")
        .upload(fileName, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Preview imediato via blob local — independente de bucket público
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      const blobUrl = URL.createObjectURL(blob);
      setLocalPreviewUrl(blobUrl);

      // Propaga novo path (preferido)
      onPathChange?.(fileName);

      // Mantém URL legada por compatibilidade quando o handler existir.
      // Para registros novos não emitimos URL pública: o consumidor decide
      // como persistir. Aqui apenas sinalizamos que há assinatura.
      if (!assinaturaUrl && onPathChange) {
        // Caso novo: usa apenas path. Não gera URL pública.
        onAssinaturaChange(null);
      }

      toast.success("Assinatura salva!");
    } catch (error) {
      console.error("Erro ao salvar assinatura:", error);
      toast.error("Erro ao salvar assinatura");
    } finally {
      setIsSaving(false);
    }
  }, [hasSignature, ordemId, onAssinaturaChange, onPathChange, assinaturaUrl, localPreviewUrl]);

  const hasAnySignature = !!displayUrl;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full h-12 justify-between gap-2",
            hasAnySignature && "border-success/50 bg-success/5"
          )}
        >
          <div className="flex items-center gap-2">
            <PenTool className={cn(
              "w-5 h-5",
              hasAnySignature ? "text-success" : "text-muted-foreground"
            )} />
            <span className="font-medium">Assinatura do Cliente</span>
            {hasAnySignature && (
              <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                ✓ Assinado
              </span>
            )}
          </div>
          <ChevronDown className={cn(
            "w-5 h-5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
          <Label className="text-sm text-muted-foreground">
            Peça ao cliente para assinar abaixo com o dedo ou mouse
          </Label>

          {/* Mostra assinatura salva (preview local, signed URL ou URL legada) */}
          {displayUrl && !hasSignature && (
            <div className="space-y-2">
              <div className="border border-success/30 rounded-xl overflow-hidden bg-white">
                <img
                  src={displayUrl}
                  alt="Assinatura do cliente"
                  className="w-full h-[150px] object-contain"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  clearCanvas();
                }}
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Refazer assinatura
              </Button>
            </div>
          )}

          {/* Canvas para desenhar */}
          {(!displayUrl || hasSignature) && (
            <>
              <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white touch-none">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full h-[150px] cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.preventDefault();
                    clearCanvas();
                  }}
                  disabled={!hasSignature || isSaving}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={(e) => {
                    e.preventDefault();
                    saveSignature();
                  }}
                  disabled={!hasSignature || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Salvar Assinatura
                </Button>
              </div>
            </>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            A assinatura confirma a entrega e o estado do veículo
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
