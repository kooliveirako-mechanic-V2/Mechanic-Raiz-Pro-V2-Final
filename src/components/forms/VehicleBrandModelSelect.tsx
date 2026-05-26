import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getBrandsForType, getModelsForBrand } from "@/lib/vehicleBrands";
import { Search, ChevronDown, X, Pencil, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface VehicleBrandModelSelectProps {
  tipo: "carro" | "moto";
  marca: string;
  modelo: string;
  onMarcaChange: (marca: string) => void;
  onModeloChange: (modelo: string) => void;
  marcaError?: string;
  modeloError?: string;
}

export function VehicleBrandModelSelect({
  tipo,
  marca,
  modelo,
  onMarcaChange,
  onModeloChange,
  marcaError,
  modeloError,
}: VehicleBrandModelSelectProps) {
  const isMobile = useIsMobile();
  const [marcaSearch, setMarcaSearch] = useState("");
  const [modeloSearch, setModeloSearch] = useState("");
  const [marcaOpen, setMarcaOpen] = useState(false);
  const [modeloOpen, setModeloOpen] = useState(false);
  const [manualMarca, setManualMarca] = useState(false);
  const [manualModelo, setManualModelo] = useState(false);
  const marcaRef = useRef<HTMLDivElement>(null);
  const modeloRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click/touch
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (marcaRef.current && !marcaRef.current.contains(target)) setMarcaOpen(false);
      if (modeloRef.current && !modeloRef.current.contains(target)) setModeloOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const brands = useMemo(() => getBrandsForType(tipo), [tipo]);
  const models = useMemo(() => getModelsForBrand(marca, tipo), [marca, tipo]);

  const filteredBrands = useMemo(() => {
    if (!marcaSearch) return brands;
    const term = marcaSearch.toLowerCase();
    return brands.filter(b => b.name.toLowerCase().includes(term));
  }, [brands, marcaSearch]);

  const filteredModels = useMemo(() => {
    if (!modeloSearch) return models;
    const term = modeloSearch.toLowerCase();
    return models.filter(m => m.toLowerCase().includes(term));
  }, [models, modeloSearch]);

  const handleSelectMarca = (brandName: string) => {
    onMarcaChange(brandName);
    setMarcaSearch("");
    setMarcaOpen(false);
    setManualModelo(false);
    if (marca !== brandName) {
      onModeloChange("");
    }
  };

  const handleSelectModelo = (modelName: string) => {
    onModeloChange(modelName);
    setModeloSearch("");
    setModeloOpen(false);
  };

  return (
    <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
      {/* MARCA */}
      <div className="space-y-2" ref={marcaRef}>
        <div className="flex items-center justify-between">
          <Label>Marca *</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setManualMarca((v) => !v);
              setMarcaOpen(false);
            }}
          >
            {manualMarca ? (
              <><List className="w-3 h-3 mr-1" />Ver lista</>
            ) : (
              <><Pencil className="w-3 h-3 mr-1" />Digitar</>
            )}
          </Button>
        </div>

        {manualMarca ? (
          <Input
            placeholder="Digite a marca..."
            value={marca}
            onChange={(e) => {
              onMarcaChange(e.target.value);
              // Limpa modelo quando marca muda manualmente
              if (modelo) onModeloChange("");
            }}
            maxLength={50}
            autoFocus
            className={cn("h-12 text-base", marcaError && "border-destructive")}
          />
        ) : (
          <div className="relative">
            <div
              className={cn(
                "flex items-center h-12 w-full rounded-md border bg-background px-3 text-base cursor-pointer",
                marcaError ? "border-destructive" : "border-input",
                marcaOpen && "ring-2 ring-ring"
              )}
              onClick={() => setMarcaOpen(!marcaOpen)}
            >
              <span className={cn("flex-1 truncate", !marca && "text-muted-foreground")}>
                {marca || "Selecione a marca"}
              </span>
              {marca ? (
                <X
                  className="w-4 h-4 text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); onMarcaChange(""); onModeloChange(""); }}
                />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {marcaOpen && (
              <div className="absolute z-[9999] mt-1 w-full bg-popover border border-border rounded-lg shadow-lg">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    placeholder="Buscar marca..."
                    value={marcaSearch}
                    onChange={(e) => setMarcaSearch(e.target.value)}
                    className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                  <div className="p-1">
                    {filteredBrands.map((b) => (
                      <button
                        key={b.name}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors min-h-[44px]",
                          marca === b.name ? "bg-accent/20 text-accent-foreground font-medium" : "hover:bg-muted"
                        )}
                        onClick={() => handleSelectMarca(b.name)}
                      >
                        {b.name}
                      </button>
                    ))}
                    {filteredBrands.length === 0 && marcaSearch.trim() && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-muted text-primary min-h-[44px]"
                        onClick={() => { onMarcaChange(marcaSearch.trim()); setMarcaSearch(""); setMarcaOpen(false); }}
                      >
                        Usar "{marcaSearch.trim()}"
                      </button>
                    )}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-muted text-primary min-h-[44px] flex items-center gap-2"
                        onClick={() => {
                          setMarcaOpen(false);
                          setManualMarca(true);
                          setMarcaSearch("");
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Digitar marca manualmente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {marcaError && <p className="text-xs text-destructive">{marcaError}</p>}
      </div>

      {/* MODELO */}
      <div className="space-y-2" ref={modeloRef}>
        <div className="flex items-center justify-between">
          <Label>Modelo *</Label>
          {models.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setManualModelo((v) => !v);
                setModeloOpen(false);
              }}
            >
              {manualModelo ? (
                <><List className="w-3 h-3 mr-1" />Ver lista</>
              ) : (
                <><Pencil className="w-3 h-3 mr-1" />Digitar</>
              )}
            </Button>
          )}
        </div>

        {models.length === 0 || manualModelo ? (
          <Input
            placeholder="Digite o modelo..."
            value={modelo}
            onChange={(e) => onModeloChange(e.target.value)}
            maxLength={50}
            autoFocus={manualModelo}
            className={cn("h-12 text-base", modeloError && "border-destructive")}
          />
        ) : (
          <div className="relative">
            <div
              className={cn(
                "flex items-center h-12 w-full rounded-md border bg-background px-3 text-base cursor-pointer",
                modeloError ? "border-destructive" : "border-input",
                modeloOpen && "ring-2 ring-ring"
              )}
              onClick={() => setModeloOpen(!modeloOpen)}
            >
              <span className={cn("flex-1 truncate", !modelo && "text-muted-foreground")}>
                {modelo || "Selecione o modelo"}
              </span>
              {modelo ? (
                <X
                  className="w-4 h-4 text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); onModeloChange(""); }}
                />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {modeloOpen && (
              <div className="absolute z-[9999] mt-1 w-full bg-popover border border-border rounded-lg shadow-lg">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    placeholder="Buscar modelo..."
                    value={modeloSearch}
                    onChange={(e) => setModeloSearch(e.target.value)}
                    className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                  <div className="p-1">
                    {filteredModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors min-h-[44px]",
                          modelo === m ? "bg-accent/20 text-accent-foreground font-medium" : "hover:bg-muted"
                        )}
                        onClick={() => handleSelectModelo(m)}
                      >
                        {m}
                      </button>
                    ))}
                    {filteredModels.length === 0 && modeloSearch.trim() && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-muted text-primary min-h-[44px]"
                        onClick={() => { onModeloChange(modeloSearch.trim()); setModeloSearch(""); setModeloOpen(false); }}
                      >
                        Usar "{modeloSearch.trim()}"
                      </button>
                    )}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-muted text-primary min-h-[44px] flex items-center gap-2"
                        onClick={() => {
                          setModeloOpen(false);
                          setManualModelo(true);
                          setModeloSearch("");
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Digitar modelo manualmente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {modeloError && <p className="text-xs text-destructive">{modeloError}</p>}
      </div>
    </div>
  );
}
