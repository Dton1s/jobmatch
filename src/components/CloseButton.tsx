import { X } from "lucide-react";

const CLOSE_BUTTON_CLASSES = "inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0 leading-none p-0";

export function CloseButton({ label, onClick, className = "", type = "button" }: {
  label: string;
  onClick: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  return <button type={type} className={`${CLOSE_BUTTON_CLASSES}${className ? ` ${className}` : ""}`} onClick={onClick} aria-label={label}>
    <X className="w-4 h-4" size={16} strokeWidth={2} aria-hidden="true"/>
  </button>;
}
