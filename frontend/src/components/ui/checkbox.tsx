// ui/checkbox.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked: boolean;
  onCheckedChange: () => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => {
    return (
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheckedChange}
          ref={ref}
          className={cn(
            "h-4 w-4 !rounded !border border-zinc-700 bg-zinc-800 text-zinc-200 focus:ring-2 focus:ring-zinc-500",
            className
          )}
          {...props}
        />
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
