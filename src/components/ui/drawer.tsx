import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { markExplicitCloseIntent, shouldIgnoreTransientClose } from "@/lib/modalFocusGuard";

/**
 * Custom Drawer (bottom sheet) implementation.
 * Replaces vaul which had a confirmed bug: it intercepts onPointerDown
 * from native inputs and interprets them as swipe-to-close gestures,
 * making forms unusable on mobile.
 *
 * This implementation:
 * - Only allows swipe-to-close via the drag handle (top bar)
 * - Never intercepts touch events on form content
 * - Keeps the exact same API as before so no migration is needed
 * - Uses a global counter so nested drawers don't corrupt body styles
 */

// ─── Global body-lock counter ───────────────────────────────────────
// Ensures body styles are only restored when ALL drawers are closed.
let bodyLockCount = 0;
let savedScrollY = 0;
let savedStyles: { overflow: string; position: string; top: string; width: string } | null = null;

function lockBody() {
  if (bodyLockCount === 0) {
    savedScrollY = window.scrollY;
    savedStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";
  }
  bodyLockCount++;
}

function unlockBody() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0 && savedStyles) {
    document.body.style.overflow = savedStyles.overflow;
    document.body.style.position = savedStyles.position;
    document.body.style.top = savedStyles.top;
    document.body.style.width = savedStyles.width;
    window.scrollTo(0, savedScrollY);
    savedStyles = null;
  }
}

// ─── Context ────────────────────────────────────────────────────────
interface DrawerContextValue {
  open: boolean;
  onClose: () => void;
}

const DrawerContext = React.createContext<DrawerContextValue>({
  open: false,
  onClose: () => {},
});

// ─── Root ───────────────────────────────────────────────────────────
interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  shouldScaleBackground?: boolean;
  dismissible?: boolean;
}

const Drawer = ({ open = false, onOpenChange, children }: DrawerProps) => {
  const onClose = React.useCallback(() => {
    // Check BEFORE marking intent — markExplicitCloseIntent makes the
    // guard always return false, defeating its purpose.
    if (shouldIgnoreTransientClose()) {
      return;
    }

    markExplicitCloseIntent();
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <DrawerContext.Provider value={{ open, onClose }}>
      {children}
    </DrawerContext.Provider>
  );
};
Drawer.displayName = "Drawer";

// ─── Trigger (kept for compat) ──────────────────────────────────────
const DrawerTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => (
  <button ref={ref} type="button" {...props}>
    {children}
  </button>
));
DrawerTrigger.displayName = "DrawerTrigger";

// ─── Portal ─────────────────────────────────────────────────────────
const DrawerPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
};

// ─── Overlay ────────────────────────────────────────────────────────
const DrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { onClose } = React.useContext(DrawerContext);
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/80 animate-in fade-in-0",
        className
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      {...props}
    />
  );
});
DrawerOverlay.displayName = "DrawerOverlay";

// ─── Close ──────────────────────────────────────────────────────────
const DrawerClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => {
  const { onClose } = React.useContext(DrawerContext);
  return (
    <button ref={ref} type="button" onClick={onClose} {...props}>
      {children}
    </button>
  );
});
DrawerClose.displayName = "DrawerClose";

// ─── Content ────────────────────────────────────────────────────────
const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, onClose } = React.useContext(DrawerContext);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);
  const startYRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);
  const currentTranslateRef = React.useRef(0);

  // Merge refs
  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      (sheetRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref]
  );

  // Lock body scroll when open — uses global counter for nesting safety
  React.useEffect(() => {
    if (!open) return;

    lockBody();

    // NOTE: We intentionally do NOT add a document-level touchmove listener.
    // lockBody() already sets body to position:fixed + overflow:hidden which
    // prevents body scrolling. A non-passive touchmove listener on document
    // was the root cause of scroll freezes: the browser must wait for JS
    // before it can start scrolling, causing touch lag and frozen scroll
    // inside nested modals, ScrollAreas, and select dropdowns.

    return () => {
      unlockBody();
    };
  }, [open]);

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Handle-only swipe to close
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-drawer-close]")) return;

    isDraggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    currentTranslateRef.current = 0;
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    if (deltaY > 0 && sheetRef.current) {
      currentTranslateRef.current = deltaY;
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const onTouchEnd = React.useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startYRef.current = null;

    if (sheetRef.current) {
      if (currentTranslateRef.current > 80) {
        sheetRef.current.style.transition = "transform 0.2s ease-out";
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(onClose, 200);
      } else {
        sheetRef.current.style.transition = "transform 0.2s ease-out";
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
    currentTranslateRef.current = 0;
  }, [onClose]);

  if (!open) return null;

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <div
        ref={mergedRef}
        data-drawer-content=""
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[10px] border bg-background",
          "animate-in slide-in-from-bottom duration-300",
          className
        )}
        style={{ maxHeight: "95vh" }}
        {...props}
      >
        {/* Drag handle — ONLY area that triggers swipe-to-close */}
        <div
          ref={handleRef}
          className="relative pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="mx-auto h-1.5 w-[60px] rounded-full bg-muted" />
          <button
            type="button"
            onClick={() => {
              markExplicitCloseIntent();
              onClose();
            }}
            data-drawer-close=""
            className="absolute right-3 top-1.5 p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content — touch events pass through normally to inputs */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

// ─── Header ─────────────────────────────────────────────────────────
const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

// ─── Footer ─────────────────────────────────────────────────────────
const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

// ─── Title ──────────────────────────────────────────────────────────
const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

// ─── Description ────────────────────────────────────────────────────
const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
