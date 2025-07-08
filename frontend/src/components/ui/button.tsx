import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base = `
      inline-flex items-center justify-center text-sm font-medium rounded-md px-2 py-2 h-8
      transition-all duration-100 ease-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30
      disabled:opacity-50 disabled:pointer-events-none
      border noselect
    `;

    const variants = {
      default: `
        bg-blue-600 text-white border-blue-700
        hover:bg-blue-700 hover:border-blue-800
        active:scale-[0.95] active:shadow-inner active:border-blue-900
      `,
      outline: `
        bg-transparent text-white border-white/30
        hover:bg-white/10 hover:border-white/50
        active:bg-white/20 active:scale-[0.95] active:shadow-inner
      `,
      destructive: `
        bg-red-600 text-white border-red-700
        hover:bg-red-700 hover:border-red-800
        active:scale-[0.95] active:shadow-inner active:border-red-900
      `,
      ghost: `
        bg-transparent text-white border-white/20
        hover:bg-white/10 hover:border-white/40
        active:bg-white/20 active:scale-[0.95] active:shadow-inner
      `,
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
