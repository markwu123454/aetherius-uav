import {cn} from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "destructive" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({className, variant = "default", ...props}, ref) => {
        const base = `
  inline-flex items-center justify-center text-sm font-medium rounded-md
  transition-all duration-100 ease-out
  focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20
  disabled:opacity-50 disabled:pointer-events-none
  active:scale-[0.9] active:shadow-[0_0_10px_rgba(100,255,255,0.1)] active:shadow-inner
`;

        const variants = {
            default:
                "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.9] active:shadow-[0_0_10px_rgba(100,255,255,0.1)] focus-visible:ring-1 focus-visible:ring-blue-500/60",
            outline:
                "border border-white/20 bg-transparent text-white hover:bg-white/10 active:bg-white/20 active:scale-[0.9] active:shadow-[0_0_10px_rgba(100,255,255,0.1)] focus-visible:ring-1 focus-visible:ring-white/30",
            destructive:
                "bg-red-600 text-white hover:bg-red-700 active:scale-[0.9] active:shadow-[0_0_10px_rgba(100,255,255,0.1)] focus-visible:ring-1 focus-visible:ring-red-500/60",
            ghost:
                "bg-transparent text-white hover:bg-white/10 active:bg-white/20 active:scale-[0.9] active:shadow-[0_0_10px_rgba(100,255,255,0.1)] focus-visible:ring-1 focus-visible:ring-white/30",
        };

        return (
            <button ref={ref} className={cn(base, variants[variant], className)} {...props} />
        );
    }
);
Button.displayName = "Button";
