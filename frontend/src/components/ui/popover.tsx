// ui/popover.tsx
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PopoverProps {
  children: React.ReactNode;
}

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const PopoverContext = React.createContext<{
  open: boolean;
  toggle: () => void;
}>({ open: false, toggle: () => {} });

export function Popover({ children }: PopoverProps) {
  const [open, setOpen] = React.useState(false);
  const toggle = () => setOpen((o) => !o);

  return (
    <PopoverContext.Provider value={{ open, toggle }}>
      <div className={cn("relative inline-block text-left")}>{children}</div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ children, asChild = false }: PopoverTriggerProps) {
  const { toggle } = React.useContext(PopoverContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: toggle,
    });
  }
  return (
    <button
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium",
        "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 focus:outline-none"
      )}
    >
      {children}
    </button>
  );
}

export function PopoverContent({ children, className, ...props }: PopoverContentProps) {
  const { open } = React.useContext(PopoverContext);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "!absolute left-0 top-full !mt-1 !z-50 rounded-md bg-zinc-900 !p-2 shadow-lg !border border-2px !border-zinc-800",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}