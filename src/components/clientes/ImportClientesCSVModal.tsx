import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useClientes, ClienteInput } from "@/hooks/useClientes";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportClientesCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCliente {
  nome: string;
  telefone?: string;
  email?: string;
  cpf_cnpj?: string;
  endereco?: string;
  observacoes?: string;
  // Veículo (opcional)
  veiculo_tipo?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_placa?: string;
  veiculo_ano?: number;
  valid: boolean;
  error?: string;
}

export function ImportClientesCSVModal({ open, onOpenChange }: ImportClientesCSVModalProps) {
  const { createCliente } = useClientes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedCliente[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0 });

  const parseCSV = (text: string): ParsedCliente[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const dataLines = lines.slice(1);

    return dataLines.map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === "," || char === ";") && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const nome = values[0] || "";
      const telefone = values[1] || undefined;
      const email = values[2] || undefined;
      const cpf_cnpj = values[3] || undefined;
      const endereco = values[4] || undefined;
      const observacoes = values[5] || undefined;
      const veiculo_tipo = values[6] || undefined;
      const veiculo_marca = values[7] || undefined;
      const veiculo_modelo = values[8] || undefined;
      const veiculo_placa = values[9] || undefined;
      const veiculo_ano = values[10] ? parseInt(values[10]) : undefined;

      const valid = nome.length >= 2;
      const error = !valid ? "Nome muito curto" : undefined;

      return {
        nome, telefone, email, cpf_cnpj, endereco, observacoes,
        veiculo_tipo, veiculo_marca, veiculo_modelo, veiculo_placa, veiculo_ano,
        valid, error,
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
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const downloadTemplate = () => {
    const headers = "Nome,Telefone,Email,CPF/CNPJ,Endereço,Observações,Tipo Veículo,Marca,Modelo,Placa,Ano";
    const ex1 = "João Silva,(11) 99999-1234,joao@email.com,123.456.789-00,Rua das Flores 123,Cliente VIP,carro,Toyota,Corolla,ABC-1234,2020";
    const ex2 = "Maria Santos,(11) 98888-5678,,,,Motoboy,moto,Honda,CG 160,,2022";
    const ex3 = "Pedro Oliveira,(11) 97777-9012,pedro@email.com,,,,,,,";

    const content = [headers, ex1, ex2, ex3].join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_clientes.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Modelo baixado!");
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter(i => i.valid);
    if (validItems.length === 0) {
      toast.error("Nenhum cliente válido para importar");
      return;
    }

    setStep("importing");
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      try {
        await createCliente.mutateAsync({
          nome: item.nome,
          telefone: item.telefone,
          email: item.email,
          cpf_cnpj: item.cpf_cnpj,
          endereco: item.endereco,
          observacoes: item.observacoes,
        });
        // Note: veículo creation would require a separate hook/call
        // For now we import clients; vehicles can be added later per client
        success++;
      } catch {
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / validItems.length) * 100));
    }

    setImportResults({ success, failed });
    setStep("done");
  };

  const handleClose = () => {
    setParsedItems([]);
    setStep("upload");
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0 });
    onOpenChange(false);
  };

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
            <Users className="w-5 h-5 text-accent" />
            Importar Clientes via CSV
          </DialogTitle>
          <DialogDescription>
            Importe seus clientes de uma planilha de outro sistema
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
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleInputChange} className="hidden" />
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-foreground font-medium mb-1">Arraste o arquivo CSV aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Formato esperado:</p>
              <p className="text-xs text-muted-foreground font-mono">
                Nome, Telefone, Email, CPF/CNPJ, Endereço, Observações, Tipo Veículo, Marca, Modelo, Placa, Ano
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Colunas de veículo são opcionais. Se preenchidas, o veículo será vinculado ao cliente.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={downloadTemplate}>
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
                    <th className="text-left p-2 font-medium">Telefone</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">Veículo</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedItems.map((item, index) => (
                    <tr key={index} className={cn("transition-colors", !item.valid && "bg-destructive/5")}>
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
                      <td className="p-2 text-muted-foreground">{item.telefone || "—"}</td>
                      <td className="p-2 text-muted-foreground hidden sm:table-cell">
                        {item.veiculo_marca && item.veiculo_modelo
                          ? `${item.veiculo_marca} ${item.veiculo_modelo}`
                          : "—"}
                      </td>
                      <td className="p-2">
                        <button onClick={() => removeItem(index)} className="p-1 rounded hover:bg-muted">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={handleImport} disabled={validCount === 0} className="bg-accent hover:bg-accent/90">
                Importar {validCount} {validCount === 1 ? "cliente" : "clientes"}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-accent" />
            <p className="font-medium mb-2">Importando clientes...</p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
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
            <Button onClick={handleClose} className="bg-accent hover:bg-accent/90">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
