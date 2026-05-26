import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme("light")}
        className={`relative rounded-full px-3 py-1 ${
          theme === "light" 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium">Claro</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme("dark")}
        className={`relative rounded-full px-3 py-1 ${
          theme === "dark" 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon className="w-4 h-4 mr-1.5" />
        <span className="text-xs font-medium">Escuro</span>
      </Button>
    </div>
  );
}

export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </motion.button>
  );
}
