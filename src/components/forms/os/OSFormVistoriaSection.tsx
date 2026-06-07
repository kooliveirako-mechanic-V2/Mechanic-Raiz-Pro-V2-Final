import { Button } from "@/components/ui/button";
import { SectionHeader } from "./SectionHeader";
import { ChecklistDVI } from "../ChecklistDVI";
import { SignaturePad } from "../SignaturePad";
import { ElectricDVIWizard, ElectricDVIData } from "../ElectricDVIWizard";
import { ShieldCheck, ClipboardCheck, Camera, PenTool } from "lucide-react";

interface Props {
  isAutoEletrica: boolean;
  tipoVeiculo: string;
  // Checklist
  showChecklist: boolean;
  setShowChecklist: (v: boolean) => void;
  checklistCombustivel: string;
  setChecklistCombustivel: (v: string) => void;
  checklistRiscos: boolean;
  setChecklistRiscos: (v: boolean) => void;
  checklistEstepe: boolean;
  setChecklistEstepe: (v: boolean) => void;
  checklistSom: boolean;
  setChecklistSom: (v: boolean) => void;
  checklistLuzes: boolean;
  setChecklistLuzes: (v: boolean) => void;
  fotosEntrada: string[];
  setFotosEntrada: (v: string[]) => void;
  ordemId?: string;
  // Electric DVI
  electricDVIData: ElectricDVIData;
  setElectricDVIData: (v: ElectricDVIData) => void;
  electricDVIOpen: boolean;
  setElectricDVIOpen: (v: boolean) => void;
  // Fotos
  showFotos: boolean;
  setShowFotos: (v: boolean) => void;
  // Assinatura
  showAssinatura: boolean;
  setShowAssinatura: (v: boolean) => void;
  assinaturaClienteUrl: string | null;
  setAssinaturaClienteUrl: (v: string | null) => void;
}

export function OSFormVistoriaSection(props: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={ShieldCheck} title="Complementos (opcional)" subtitle="Checklist, fotos e assinatura — blindam sua oficina" color="text-success" step={5} />

      {props.isAutoEletrica && (
        <ElectricDVIWizard
          data={props.electricDVIData}
          onChange={props.setElectricDVIData}
          ordemId={props.ordemId}
          isOpen={props.electricDVIOpen}
          onOpenChange={props.setElectricDVIOpen}
          requiredHipotese={true}
        />
      )}

      <div className="grid grid-cols-1 gap-3">
        {!props.isAutoEletrica && (
          <>
            <Button
              type="button"
              variant={props.showChecklist ? "default" : "outline"}
              className={`h-14 text-base font-semibold justify-start gap-3 ${
                props.showChecklist 
                  ? "bg-success hover:bg-success/90 text-success-foreground" 
                  : "border-success/40 text-success hover:bg-success/5"
              }`}
              onClick={() => props.setShowChecklist(!props.showChecklist)}
            >
              <ClipboardCheck className="w-5 h-5" />
              {props.showChecklist ? "✓ Checklist de Entrada Aberto" : "Realizar Checklist de Entrada"}
            </Button>
            
            {props.showChecklist && (
              <div className="pl-2 border-l-4 border-success/50">
                <ChecklistDVI
                  combustivel={props.checklistCombustivel}
                  setCombustivel={props.setChecklistCombustivel}
                  riscos={props.checklistRiscos}
                  setRiscos={props.setChecklistRiscos}
                  estepe={props.checklistEstepe}
                  setEstepe={props.setChecklistEstepe}
                  som={props.checklistSom}
                  setSom={props.setChecklistSom}
                  luzes={props.checklistLuzes}
                  setLuzes={props.setChecklistLuzes}
                  fotos={props.fotosEntrada}
                  setFotos={props.setFotosEntrada}
                  ordemId={props.ordemId}
                  tipoVeiculo={props.tipoVeiculo as "carro" | "moto"}
                />
              </div>
            )}
          </>
        )}

        {props.isAutoEletrica && (
          <Button
            type="button"
            variant={props.showFotos ? "default" : "outline"}
            className={`h-14 text-base font-semibold justify-start gap-3 ${
              props.showFotos 
                ? "bg-info hover:bg-info/90 text-info-foreground" 
                : "border-info/40 text-info hover:bg-info/5"
            }`}
            onClick={() => props.setShowFotos(!props.showFotos)}
          >
            <Camera className="w-5 h-5" />
            {props.fotosEntrada.length > 0 ? `📸 ${props.fotosEntrada.length} Arquivo(s) Anexado(s)` : "Fotos e Vídeos do Veículo"}
          </Button>
        )}

        <Button
          type="button"
          variant={props.showAssinatura ? "default" : "outline"}
            className={`h-14 text-base font-semibold justify-start gap-3 ${
              props.showAssinatura 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                : "border-primary/40 text-primary hover:bg-primary/5"
            }`}
          onClick={() => props.setShowAssinatura(!props.showAssinatura)}
        >
          <PenTool className="w-5 h-5" />
          {props.assinaturaClienteUrl ? "✓ Assinatura Coletada" : "Coletar Assinatura do Cliente"}
        </Button>

        {props.showAssinatura && (
          <div className="pl-2 border-l-4 border-primary/50">
            <SignaturePad
              assinaturaUrl={props.assinaturaClienteUrl}
              onAssinaturaChange={props.setAssinaturaClienteUrl}
              ordemId={props.ordemId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
