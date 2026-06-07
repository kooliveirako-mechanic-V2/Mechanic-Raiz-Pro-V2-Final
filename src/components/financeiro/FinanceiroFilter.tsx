import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface FinanceiroFilterProps {
  dateRange: { start: string; end: string } | null;
  onFilterChange: (range: { start: string; end: string } | null) => void;
  origemFilter?: string;
  onOrigemFilterChange?: (origem: string) => void;
  children?: ReactNode;
}

export function FinanceiroFilter({ dateRange, onFilterChange, origemFilter, onOrigemFilterChange, children }: FinanceiroFilterProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(
    dateRange?.start || format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    dateRange?.end || format(endOfMonth(new Date()), "yyyy-MM-dd")
  );

  const handleApply = () => {
    onFilterChange({ start: startDate, end: endDate });
    setOpen(false);
  };

  const handleClear = () => {
    onFilterChange(null);
    setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Filtrar por período</h4>
            <p className="text-xs text-muted-foreground">
              Selecione o intervalo de datas para filtrar
            </p>
          </div>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs">Data início</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">Data fim</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>

            {onOrigemFilterChange && (
              <div className="space-y-1.5">
                <Label className="text-xs">Origem</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { value: "todos", label: "Todas" },
                    { value: "os", label: "OS" },
                    { value: "manual", label: "Manual" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onOrigemFilterChange(opt.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        (origemFilter || "todos") === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleClear}>
              Limpar
            </Button>
            <Button size="sm" className="flex-1" onClick={handleApply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
