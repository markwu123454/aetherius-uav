import React from "react";
import { cn } from "@/lib/utils";

interface InputProps {
  /** Controlled value, can be string or number */
  value?: string | number;
  /** Default value for uncontrolled input, string or number */
  defaultValue?: string | number;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Input type: text or number */
  type?: "text" | "number";
}

export const Input: React.FC<InputProps> = ({
  value,
  defaultValue,
  onChange,
  placeholder,
  type = "text",
}) => (
  <input
    type={type}
    value={value}
    defaultValue={defaultValue}
    onChange={onChange}
    placeholder={placeholder}
    className={cn(
      "w-full bg-black !text-zinc-300 placeholder-zinc-500 !px-2 !py-1 focus:outline-none !focus:ring-2 !focus:ring-zinc-600 !focus:border-zinc-600",
      "!border-2 !border-zinc-700 !rounded-lg"
    )}
  />
);
Input.displayName = "Input";