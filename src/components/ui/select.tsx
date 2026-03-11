import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-8 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)]",
        className
      )}
      {...props}
    />
  );
});

export { Select };
