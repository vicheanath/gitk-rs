import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

interface DiffControlsProps {
  navigatorMode: "tree" | "files";
  setNavigatorMode: (mode: "tree" | "files") => void;
  diffDisplayMode: "unified" | "split";
  setDiffDisplayMode: (mode: "unified" | "split") => void;
  contextLines: number;
  setContextLines: (lines: number) => void;
  ignoreWhitespace: boolean;
  setIgnoreWhitespace: (ignore: boolean) => void;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--bg-tertiary)_72%,transparent)] p-0.5">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-2.5 py-0.5 text-xs font-medium transition-all",
              isActive
                ? "bg-[var(--accent)] text-[#0b1117] shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DiffControls({
  navigatorMode,
  setNavigatorMode,
  diffDisplayMode,
  setDiffDisplayMode,
  contextLines,
  setContextLines,
  ignoreWhitespace,
  setIgnoreWhitespace,
}: DiffControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--bg-secondary)_66%,transparent)] px-1.5 py-1">
      {/* Navigator Mode */}
      <SegmentedControl
        options={[
          { label: "Tree", value: "tree" },
          { label: "Files", value: "files" },
        ]}
        value={navigatorMode}
        onChange={setNavigatorMode}
      />

      <div className="h-4 w-px bg-[color-mix(in_srgb,var(--border-color)_50%,transparent)]" />

      {/* Diff Display Mode */}
      <SegmentedControl
        options={[
          { label: "Unified", value: "unified" },
          { label: "Split", value: "split" },
        ]}
        value={diffDisplayMode}
        onChange={setDiffDisplayMode}
      />

      <div className="h-4 w-px bg-[color-mix(in_srgb,var(--border-color)_50%,transparent)]" />

      {/* Context Lines */}
      <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <span>Context lines</span>
        <Input
          type="number"
          min="0"
          max="100"
          className="h-6 w-14 text-center text-xs"
          value={contextLines}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val) && val >= 0 && val <= 100) {
              setContextLines(val);
            }
          }}
        />
      </label>

      {/* Ignore Whitespace */}
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
        <div
          role="checkbox"
          aria-checked={ignoreWhitespace}
          tabIndex={0}
          onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
          onKeyDown={(e) => e.key === " " && setIgnoreWhitespace(!ignoreWhitespace)}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border transition-all",
            ignoreWhitespace
              ? "border-[var(--accent)] bg-[var(--accent)]"
              : "border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent)]"
          )}
        >
          {ignoreWhitespace && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#0b1117" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className={cn("transition-colors", ignoreWhitespace ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]")}>
          Ignore whitespace
        </span>
      </label>
    </div>
  );
}
