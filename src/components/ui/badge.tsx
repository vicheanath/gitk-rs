import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "muted" | "success" | "danger";
}

const variantClass: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border-[var(--border-primary)] text-[var(--text-secondary)]",
  muted: "border-[var(--border-primary)] text-[var(--text-muted)]",
  success: "border-[var(--border-primary)] text-[var(--success)]",
  danger: "border-[var(--border-primary)] text-[var(--danger)]",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1 py-0.5 text-[10px] uppercase tracking-wide",
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
}
