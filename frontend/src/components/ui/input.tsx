// src/components/ui/Input.tsx
import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** We default to text, but allow number, email, etc. */
  type?: React.HTMLInputTypeAttribute;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  ...props
}, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "!w-full !text-zinc-300 !placeholder-zinc-400 !px-2 !py-1 focus:outline-none focus:ring-0 focus:!ring-zinc-600 focus:!border-zinc-500",
        "!border-2 !border-zinc-700 !rounded-md",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
