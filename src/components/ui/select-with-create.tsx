import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface SelectWithCreateProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  createLabel?: string;
  createPlaceholder?: string;
  onCreateNew?: (newValue: string) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function SelectWithCreate({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  createLabel = "Outro",
  createPlaceholder = "Digite o nome...",
  onCreateNew,
  className,
  triggerClassName,
  disabled,
}: SelectWithCreateProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "__create_new__") {
      setShowCustomInput(true);
      setCustomValue("");
    } else {
      setShowCustomInput(false);
      onValueChange(selectedValue);
    }
  };

  const handleCreateNew = () => {
    if (customValue.trim() && onCreateNew) {
      onCreateNew(customValue.trim());
      setShowCustomInput(false);
      setCustomValue("");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        value={showCustomInput ? "__create_new__" : value}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn("h-12 text-base", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-base py-3">
              <span className="flex items-center gap-2">
                {option.color && (
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: option.color }} 
                  />
                )}
                {option.label}
              </span>
            </SelectItem>
          ))}
          {onCreateNew && (
            <SelectItem value="__create_new__" className="text-base py-3 text-primary">
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {createLabel}
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {showCustomInput && (
        <div className="flex gap-2">
          <Input
            placeholder={createPlaceholder}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="h-10 flex-1"
            autoFocus={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateNew();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreateNew}
            disabled={!customValue.trim()}
            className="h-10"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
