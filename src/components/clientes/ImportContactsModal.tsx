import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useClientes } from "@/hooks/useClientes";
import { useOficina } from "@/contexts/OficinaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle,
  X, Users, FileText, ArrowRight, ArrowLeft, RefreshCw, UserPlus, UserX, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ImportedContact,
  ImportReport,
  parseVCF,
  parseCSV,
  detectDuplicates,
  downloadCSVTemplate,
} from "@/lib/contactImport";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ImportContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "source" | "preview" | "dedup" | "importing" | "done";

export function ImportContactsModal({ open, onOpenChange }: ImportContactsModalProps) {
  const { clientes } = useClientes();
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [step, setStep] = useState<Step>("source");
  const [importProgress, setImportProgress] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [sourceType, setSourceType] = useState<"vcf" | "csv" | null>(null);

  const handleFile = (file: File) => {
    const ext = file.name.toLowerCase();
    const isVCF = ext.endsWith(".vcf") || ext.endsWith(".vcard");
    const isCSV = ext.endsWith(".csv") || ext.endsWith(".txt");

    if (!isVCF && !isCSV) {
      toast.error("Formato não suportado", { description: "Use arquivo .vcf ou .csv" });
      return;
    }

    setSourceType(isVCF ? "vcf" : "csv");

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = isVCF ? parseVCF(text) : parseCSV(text);

      if (parsed.length === 0) {
        toast.error("Nenhum contato encontrado", { description: "Verifique o formato do arquivo" });
        return;
      }

      const withDupes = detectDuplicates(parsed, clientes);
      setContacts(withDupes);
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

  const setAction = (id: string, action: ImportedContact["action"]) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, action } : c)));
  };

  const removeContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const stats = useMemo(() => {
    const valid = contacts.filter((c) => c.valid && !c.internalDuplicate);
    const invalid = contacts.filter((c) => !c.valid);
    const duplicatesDb = contacts.filter((c) => c.duplicateOf);
    const duplicatesInternal = contacts.filter((c) => c.internalDuplicate);
    const toCreate = contacts.filter((c) => c.valid && !c.internalDuplicate && c.action === "criar");
    const toIgnore = contacts.filter((c) => c.action === "ignorar");
    return { valid, invalid, duplicatesDb, duplicatesInternal, toCreate, toIgnore, total: contacts.length };
  }, [contacts]);

  const handleImport = async () => {
    const toCreate = contacts.filter((c) => c.valid && !c.internalDuplicate && c.action === "criar");
    if (toCreate.length === 0) {
      toast.error("Nenhum contato para importar");
      return;
    }

    if (!oficinaAtual) {
      toast.error("Oficina não selecionada");
      return;
    }

    const loteId = crypto.randomUUID().slice(0, 8);
    setStep("importing");
    setImportProgress(10);

    // Monta payload para a RPC atômica.
    // Cada cliente já carrega "Origem: ..." nas observações; a RPC adiciona "Lote: <id>" no final.
    const payload = toCreate.map((contact) => ({
      nome: contact.nome,
      telefone: contact.telefone || null,
      email: contact.email || null,
      cpf_cnpj: contact.cpf_cnpj || null,
      endereco: contact.endereco || null,
      observacoes: [contact.observacoes, `Origem: ${contact.origem}`]
        .filter(Boolean)
        .join(" | "),
    }));

    setImportProgress(40);

    let created = 0;
    let duplicadosNaImportacao = 0;
    let failed = 0;

    try {
      // ARQUITETURA ATÔMICA: importação em transação única (tudo ou nada por cliente,
      // com tratamento de exceção por linha dentro do BEGIN/EXCEPTION da RPC).
      const { data, error } = await supabase.rpc(
        "importar_clientes_lote" as never,
        {
          p_oficina_id: oficinaAtual.id,
          p_lote_id: loteId,
          p_clientes: payload,
        } as never,
      );

      setImportProgress(85);

      if (error) {
        throw new Error(error.message || "Falha na importação");
      }

      const result = (data ?? {}) as {
        criados?: number;
        duplicados?: number;
        falhas?: number;
      };

      created = Number(result.criados ?? 0);
      duplicadosNaImportacao = Number(result.duplicados ?? 0);
      failed = Number(result.falhas ?? 0);

      // Invalida cache de clientes para a UI refletir o lote inteiro
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clientes", oficinaAtual.id] }),
        queryClient.invalidateQueries({ queryKey: ["clientes_count", oficinaAtual.id] }),
      ]);

      setImportProgress(100);

      if (created > 0) {
        toast.success(`${created} cliente(s) importado(s)`, {
          description:
            duplicadosNaImportacao > 0
              ? `${duplicadosNaImportacao} já existiam (telefone duplicado)`
              : undefined,
        });
      } else if (duplicadosNaImportacao > 0 && failed === 0) {
        toast.info("Nenhum cliente novo", {
          description: `Todos os ${duplicadosNaImportacao} contatos já existiam na base.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido na importação";
      toast.error("Falha ao importar", { description: msg });
      failed = toCreate.length;
    }

    const ignorados =
      contacts.filter((c) => c.action === "ignorar").length +
      contacts.filter((c) => !c.valid).length +
      contacts.filter((c) => c.internalDuplicate).length;

    setReport({
      loteId,
      dataHora: new Date().toLocaleString("pt-BR"),
      origem: sourceType || "csv",
      totalArquivo: contacts.length,
      criados: created,
      ignorados: ignorados + duplicadosNaImportacao,
      erros: failed,
      duplicadosBase: stats.duplicatesDb.length + duplicadosNaImportacao,
      duplicadosInternos: stats.duplicatesInternal.length,
    });
    setStep("done");
  };

  const resetImport = () => {
    setContacts([]);
    setStep("source");
    setImportProgress(0);
    setReport(null);
    setSourceType(null);
  };

  // Confirm-only, sem useAutoSave (contatos vêm de File/API, não serializam em
  // rascunho). `enabled` sobre step observável: só confirma quando há contatos
  // carregados e ainda não importados — em "source" não há o que perder.
  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { contacts },
    onOpenChange,
    onReset: resetImport,
    enabled: contacts.length > 0 && step !== "importing" && step !== "done",
  });

  const handleClose = () => handleOpenChange(false);

  const copyReport = () => {
    if (!report) return;
    const text = [
      `Relatório de Importação — Lote ${report.loteId}`,
      `Data: ${report.dataHora}`,
      `Origem: ${report.origem === "vcf" ? "vCard" : "CSV"}`,
      `Total no arquivo: ${report.totalArquivo}`,
      `Criados: ${report.criados}`,
      `Ignorados: ${report.ignorados}`,
      `Duplicados (base): ${report.duplicadosBase}`,
      `Duplicados (arquivo): ${report.duplicadosInternos}`,
      `Erros: ${report.erros}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Relatório copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Importar Contatos
          </DialogTitle>
          <DialogDescription>
            Importe clientes em massa a partir de arquivos do celular ou planilhas CSV
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {step !== "source" && step !== "done" && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground px-1">
            {["Origem", "Prévia", "Duplicados", "Importando"].map((label, i) => {
              const stepNames: Step[] = ["source", "preview", "dedup", "importing"];
              const idx = stepNames.indexOf(step);
              return (
                <div key={label} className="flex items-center gap-1">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    i <= idx ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </div>
                  <span className={cn(i <= idx ? "text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                  {i < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground/50" />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP: Source ── */}
        {step === "source" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setSourceType("vcf");
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ".vcf,.vcard";
                    fileInputRef.current.click();
                  }
                }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-accent hover:bg-accent/5 transition-all cursor-pointer text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Arquivo VCF / vCard</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exporte os contatos do celular como .vcf
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setSourceType("csv");
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ".csv,.txt";
                    fileInputRef.current.click();
                  }
                }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-accent hover:bg-accent/5 transition-all cursor-pointer text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Arquivo CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Importe de planilha (salve como .csv primeiro)
                  </p>
                </div>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".vcf,.vcard,.csv,.txt"
              onChange={handleInputChange}
              className="hidden"
            />

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                dragActive ? "border-accent bg-accent/5" : "border-border"
              )}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ou arraste um arquivo aqui (.vcf ou .csv)
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">💡 Como exportar contatos do celular?</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Android:</strong> Contatos → ⋮ → Exportar → Salvar como .vcf</p>
                <p><strong>iPhone:</strong> iCloud.com → Contatos → ⚙ → Exportar vCard</p>
                <p><strong>Google:</strong> contacts.google.com → Exportar → vCard ou CSV</p>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar modelo CSV
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                ⚠️ Este MVP importa apenas <strong>clientes</strong>. Veículos devem ser cadastrados separadamente.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Preview ── */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="gap-1 text-xs">
                <Users className="w-3 h-3" />
                {stats.total} encontrados
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle2 className="w-3 h-3" />
                {stats.valid.length} válidos
              </Badge>
              {stats.invalid.length > 0 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  {stats.invalid.length} inválidos
                </Badge>
              )}
              {(stats.duplicatesDb.length > 0 || stats.duplicatesInternal.length > 0) && (
                <Badge variant="outline" className="gap-1 text-xs border-amber-300 text-amber-600">
                  <RefreshCw className="w-3 h-3" />
                  {stats.duplicatesDb.length + stats.duplicatesInternal.length} duplicados
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Nome</th>
                    <th className="text-left p-2 font-medium">Telefone</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">Status</th>
                    <th className="w-8 p-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className={cn(
                      "transition-colors",
                      !contact.valid && "bg-destructive/5",
                      contact.internalDuplicate && "bg-amber-500/5",
                      contact.duplicateOf && contact.valid && "bg-amber-500/5"
                    )}>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          {contact.valid && !contact.internalDuplicate ? (
                            contact.duplicateOf ? (
                              <RefreshCw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          )}
                          <span className="truncate max-w-[140px]">{contact.nome}</span>
                        </div>
                        {contact.duplicateOf && (
                          <p className="text-[10px] text-amber-600 ml-5">
                            = {contact.duplicateOf.nome}
                          </p>
                        )}
                        {contact.internalDuplicate && (
                          <p className="text-[10px] text-amber-600 ml-5">
                            Repetido no arquivo
                          </p>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground text-xs">{contact.telefone || "—"}</td>
                      <td className="p-2 hidden sm:table-cell">
                        {contact.valid && !contact.internalDuplicate && (
                          <Badge variant={contact.action === "ignorar" ? "outline" : "secondary"} className="text-[10px]">
                            {contact.action === "criar" ? "Novo" : "Ignorar"}
                          </Badge>
                        )}
                        {(!contact.valid || contact.internalDuplicate) && (
                          <span className="text-[10px] text-destructive">{contact.error}</span>
                        )}
                      </td>
                      <td className="p-2">
                        <button onClick={() => removeContact(contact.id)} className="p-1 rounded hover:bg-muted">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between mt-3 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => { setStep("source"); setContacts([]); }}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              {stats.duplicatesDb.length > 0 ? (
                <Button size="sm" onClick={() => setStep("dedup")} className="bg-accent hover:bg-accent/90">
                  Revisar duplicados <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleImport} disabled={stats.toCreate.length === 0} className="bg-accent hover:bg-accent/90">
                  Importar {stats.toCreate.length} clientes <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: Dedup ── */}
        {step === "dedup" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <p className="text-sm text-muted-foreground mb-3">
              Encontramos <strong>{stats.duplicatesDb.length}</strong> contatos que já existem na sua base.
              Escolha o que fazer com cada um:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2">
              {contacts.filter((c) => c.duplicateOf && c.valid).map((contact) => (
                <div key={contact.id} className="border rounded-lg p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm">{contact.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.telefone} {contact.email ? `• ${contact.email}` : ""}
                    </p>
                  </div>
                  <div className="bg-amber-500/10 rounded p-2 text-xs">
                    <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>Já existe na base:</p>
                    <p className="text-muted-foreground">
                      {contact.duplicateOf?.nome} — {contact.duplicateOf?.telefone || "sem telefone"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant={contact.action === "criar" ? "default" : "outline"}
                      className={cn("h-7 text-xs", contact.action === "criar" && "bg-accent")}
                      onClick={() => setAction(contact.id, "criar")}
                    >
                      <UserPlus className="w-3 h-3 mr-1" /> Criar mesmo assim
                    </Button>
                    <Button
                      size="sm"
                      variant={contact.action === "ignorar" ? "default" : "outline"}
                      className={cn("h-7 text-xs", contact.action === "ignorar" && "bg-muted text-muted-foreground")}
                      onClick={() => setAction(contact.id, "ignorar")}
                    >
                      <UserX className="w-3 h-3 mr-1" /> Ignorar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-3 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setStep("preview")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button size="sm" onClick={handleImport} disabled={stats.toCreate.length === 0} className="bg-accent hover:bg-accent/90">
                Importar {stats.toCreate.length} clientes
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: Importing ── */}
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

        {/* ── STEP: Done ── */}
        {step === "done" && report && (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
            <p className="text-lg font-medium mb-4">Importação concluída!</p>

            <div className="flex items-center justify-center gap-6 mb-4 flex-wrap">
              {report.criados > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-500">{report.criados}</p>
                  <p className="text-xs text-muted-foreground">criados</p>
                </div>
              )}
              {report.ignorados > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{report.ignorados}</p>
                  <p className="text-xs text-muted-foreground">ignorados</p>
                </div>
              )}
              {report.erros > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{report.erros}</p>
                  <p className="text-xs text-muted-foreground">com erro</p>
                </div>
              )}
            </div>

            {/* Audit report */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-left text-muted-foreground mb-4 mx-auto max-w-sm space-y-1">
              <p className="font-medium text-foreground">Relatório do lote</p>
              <p>Lote: <span className="font-mono">{report.loteId}</span></p>
              <p>Data: {report.dataHora}</p>
              <p>Origem: {report.origem === "vcf" ? "vCard (.vcf)" : "CSV (.csv)"}</p>
              <p>Total no arquivo: {report.totalArquivo}</p>
              <p>Duplicados na base: {report.duplicadosBase}</p>
              <p>Duplicados no arquivo: {report.duplicadosInternos}</p>
              <p className="pt-1 text-[10px] italic">
                Cada cliente criado tem "Lote: {report.loteId}" nas observações para rastreabilidade.
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={copyReport}>
                <Copy className="w-4 h-4 mr-1" /> Copiar relatório
              </Button>
              <Button onClick={handleClose} className="bg-accent hover:bg-accent/90">Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Descartar importação?"
        description="Você carregou contatos e ainda não importou. A lista revisada será descartada."
        confirmText="Descartar"
        cancelText="Continuar importação"
        onConfirm={confirmClose}
      />
    </Dialog>
  );
}
