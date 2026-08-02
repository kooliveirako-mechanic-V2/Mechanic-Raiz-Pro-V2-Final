import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEstoque, ItemEstoqueInput } from "@/hooks/useEstoque";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedItem {
  nome: string;
  categoria: string;
  quantidade: number;
  custo_unitario: number;
  preco_venda: number;
  alerta_minimo: number;
  localizacao?: string;
  codigo?: string;
  fornecedor_nome?: string;
  valid: boolean;
  error?: string;
}

export function ImportCSVModal({ open, onOpenChange }: ImportCSVModalProps) {
  const { createItem } = useEstoque();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0 });

  const parseCSV = (text: string): ParsedItem[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    // Skip header line
    const dataLines = lines.slice(1);
    
    return dataLines.map((line, index) => {
      // Handle quoted fields with commas
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else if (char === ";" && !inQuotes) {
          // Also support semicolon separator (common in Brazil)
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const nome = values[0] || "";
      const categoria = values[1] || "Outro";
      const quantidade = parseInt(values[2]) || 0;
      const custo_unitario = parseFloat(values[3]?.replace(/\./g, "").replace(",", ".")) || 0;
      const preco_venda = parseFloat(values[4]?.replace(/\./g, "").replace(",", ".")) || 0;
      const alerta_minimo = parseInt(values[5]) || 5;
      const localizacao = values[6] || undefined;
      const codigo = values[7] || undefined;
      const fornecedor_nome = values[8] || undefined;

      const valid = nome.length >= 2;
      const error = !valid ? "Nome muito curto" : undefined;

      return {
        nome,
        categoria,
        quantidade,
        custo_unitario,
        preco_venda,
        alerta_minimo,
        localizacao,
        codigo,
        fornecedor_nome,
        valid,
        error,
      };
    }).filter(item => item.nome.trim() !== "");
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Formato inválido", { description: "Use arquivo .csv ou .txt" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const items = parseCSV(text);
      
      if (items.length === 0) {
        toast.error("Arquivo vazio ou formato incorreto");
        return;
      }

      setParsedItems(items);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    const headers = "Nome,Categoria,Quantidade,Custo,Preço Venda,Alerta Mínimo,Localização,Código,Fornecedor";
    const example1 = "Óleo 5W30,Óleo,10,45.00,89.90,5,Prateleira A,OLE001,Auto Peças Silva";
    const example2 = "Filtro de Ar,Filtro,8,25.00,55.00,3,Prateleira B,FIL002,Distribuidora ABC";
    const example3 = "Pastilha de Freio,Peça,4,85.00,150.00,2,Gaveta 3,PAS003,";
    
    const content = [headers, example1, example2, example3].join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_estoque.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Modelo baixado!");
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter(item => item.valid);
    if (validItems.length === 0) {
      toast.error("Nenhum item válido para importar");
      return;
    }

    setStep("importing");
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      try {
        await createItem.mutateAsync({
          nome: item.nome,
          categoria: item.categoria,
          quantidade: item.quantidade,
          custo_unitario: item.custo_unitario,
          preco_venda: item.preco_venda,
          alerta_minimo: item.alerta_minimo,
          localizacao: item.localizacao,
          codigo: item.codigo,
          fornecedor_nome: item.fornecedor_nome,
        });
        success++;
      } catch (error) {
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / validItems.length) * 100));
    }

    setImportResults({ success, failed });
    setStep("done");
  };

  const resetImport = () => {
    setParsedItems([]);
    setStep("upload");
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0 });
  };

  // Confirm-only, SEM useAutoSave: o trabalho aqui é um objeto File + o parse em
  // memória. JSON.stringify(File) vira {}, então prometer rascunho seria mentira
  // — o usuário reabriria com o mapeamento sem o arquivo.
  //
  // `enabled` sobre estado OBSERVÁVEL (step), nunca isDirty sobre File:
  //   "upload"    → nada carregado, fecha calado (nada a perder)
  //   "preview"   → CSV parseado e em revisão: confirma antes de descartar
  //   "importing" → em andamento
  //   "done"      → já gravado, fecha direto
  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { parsedItems },
    onOpenChange,
    onReset: resetImport,
    enabled: step === "preview",
  });

  const handleClose = () => handleOpenChange(false);

  const removeItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const validCount = parsedItems.filter(i => i.valid).length;
  const invalidCount = parsedItems.filter(i => !i.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" />
            Importar Estoque via CSV
          </DialogTitle>
          <DialogDescription>
            Importe vários itens de uma vez usando uma planilha CSV
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                dragActive ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleInputChange}
                className="hidden"
              />
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-foreground font-medium mb-1">
                Arraste o arquivo CSV aqui
              </p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Formato esperado:</p>
              <p className="text-xs text-muted-foreground font-mono">
                Nome, Categoria, Quantidade, Custo, Preço Venda, Alerta Mínimo, Localização, Código, Fornecedor
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar modelo CSV
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>{validCount} válidos</span>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span>{invalidCount} com erro</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Nome</th>
                    <th className="text-left p-2 font-medium">Categoria</th>
                    <th className="text-center p-2 font-medium">Qtd</th>
                    <th className="text-right p-2 font-medium">Custo</th>
                    <th className="text-right p-2 font-medium">Venda</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedItems.map((item, index) => (
                    <tr 
                      key={index} 
                      className={cn(
                        "transition-colors",
                        !item.valid && "bg-destructive/5"
                      )}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {item.valid ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[150px]">{item.nome}</span>
                        </div>
                      </td>
                      <td className="p-2 text-muted-foreground">{item.categoria}</td>
                      <td className="p-2 text-center">{item.quantidade}</td>
                      <td className="p-2 text-right text-muted-foreground">
                        R$ {item.custo_unitario.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-medium text-success">
                        R$ {item.preco_venda.toFixed(2)}
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={validCount === 0}
                className="bg-accent hover:bg-accent/90"
              >
                Importar {validCount} {validCount === 1 ? "item" : "itens"}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-accent" />
            <p className="font-medium mb-2">Importando itens...</p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div 
                className="bg-accent h-2 rounded-full transition-all" 
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{importProgress}% concluído</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-success" />
            <p className="text-lg font-medium mb-2">Importação concluída!</p>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{importResults.success}</p>
                <p className="text-sm text-muted-foreground">importados</p>
              </div>
              {importResults.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{importResults.failed}</p>
                  <p className="text-sm text-muted-foreground">com erro</p>
                </div>
              )}
            </div>
            <Button onClick={handleClose} className="bg-accent hover:bg-accent/90">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Descartar importação?"
        description="Você carregou uma planilha e ainda não importou. Os dados revisados serão descartados."
        confirmText="Descartar"
        cancelText="Continuar importação"
        onConfirm={confirmClose}
      />
    </Dialog>
  );
}
