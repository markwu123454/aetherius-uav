import { cn } from "@/lib/utils";
import React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn("w-full px-3 py-2 text-sm bg-zinc-800 text-white border border-zinc-600 rounded-md placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500", className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
