import {type ReactNode, type MouseEvent } from "react";

interface PopupModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  children?: ReactNode;
  buttons: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "danger";
  }[];
}

export default function PopupModal({
  title,
  isOpen,
  onClose,
  closeOnBackdrop = false,
  showCloseButton = false,
  children,
  buttons,
}: PopupModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center !p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-zinc-900 !rounded-2xl shadow-xl w-full max-w-md text-zinc-100 overflow-hidden">

        {/* Optional Close (X) button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute !top-4 !right-4 text-zinc-400 hover:text-white text-lg"
          >
            ×
          </button>
        )}

        {/* Title */}
        <div className="!px-6 !py-4 text-xl font-semibold">
          {title}
        </div>

        {/* Content */}
        <div className="!p-6 !space-y-4 text-sm">{children}</div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2 !px-6 !py-4 border-t border-zinc-700">
          {buttons.map(({ label, onClick, variant = "secondary" }, i) => (
            <button
              key={i}
              onClick={onClick}
              className={`!px-4 !py-2 rounded text-sm font-medium transition-colors
                ${
                  variant === "primary"
                    ? "!bg-blue-600 hover:!bg-blue-500 text-white"
                    : variant === "danger"
                    ? "!bg-red-800 hover:!bg-red-600 text-white"
                    : "!bg-zinc-700 hover:!bg-zinc-600 text-white"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
