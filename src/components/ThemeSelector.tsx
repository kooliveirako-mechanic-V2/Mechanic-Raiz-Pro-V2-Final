import { useState } from "react";
import { Moon, Sun, Monitor, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ThemeOption = "light" | "dark" | "system";

interface ThemeOptionItem {
  value: ThemeOption;
  label: string;
  icon: typeof Sun;
}

const themeOptions: ThemeOptionItem[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const currentOption = themeOptions.find(opt => opt.value === theme) || themeOptions[2];
  const CurrentIcon = currentOption.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 hover:bg-muted border border-border/50 transition-colors"
        >
          <CurrentIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground hidden sm:inline">
            {currentOption.label}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-48 p-2 bg-popover border-border shadow-lg"
        sideOffset={8}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
            Modo
          </p>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            
            return (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span className="text-sm">{option.label}</span>
              </motion.button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Versão compacta para mobile (só ícone)
export function ThemeSelectorCompact() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const currentOption = themeOptions.find(opt => opt.value === theme) || themeOptions[2];
  const CurrentIcon = currentOption.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-lg bg-muted/60 hover:bg-muted border border-border/50 flex items-center justify-center transition-colors"
        >
          <CurrentIcon className="w-4 h-4 text-muted-foreground" />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-44 p-2 bg-popover border-border shadow-lg"
        sideOffset={8}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
            Modo
          </p>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            
            return (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span className="text-sm">{option.label}</span>
              </motion.button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
