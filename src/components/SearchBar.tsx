import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export interface SearchBarRef {
  focus: () => void;
}

const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  ({ onSearch }, ref) => {
    const [query, setQuery] = useState("");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onSearch(query);
      }, 300);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [query, onSearch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    };

    return (
      <div className="relative flex min-h-7 flex-1 items-center rounded-md border border-[color-mix(in_srgb,var(--border-color)_86%,#ffffff_14%)] bg-[color-mix(in_srgb,var(--bg-primary)_92%,#000000_8%)]">
        <span className="pointer-events-none absolute left-2 inline-flex items-center justify-center text-[var(--text-secondary)]">
          <Search size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search commits (message, author, hash)..."
          value={query}
          onChange={handleChange}
          className="min-h-7 w-full rounded-md bg-transparent py-1 pl-7 pr-8 text-xs text-[var(--text-primary)] outline-none focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_52%,transparent)]"
        />
        {query && (
          <button
            className="absolute right-1 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            onClick={() => setQuery("")}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";

export default SearchBar;
