export interface AppSettings {
  /** UI color theme */
  theme: "dark" | "light";
  /** Number of context lines shown around each hunk in diff view */
  diffContextLines: number;
  /** Strip whitespace-only changes from diffs */
  diffIgnoreWhitespace: boolean;
  /** Maximum number of commits to load from the graph */
  maxCommits: 500 | 1000 | 2000 | 5000;
  /** How commit timestamps are displayed */
  dateFormat: "relative" | "absolute";
  /** Editor font size */
  fontSize: "small" | "medium" | "large";
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  diffContextLines: 3,
  diffIgnoreWhitespace: false,
  maxCommits: 1000,
  dateFormat: "relative",
  fontSize: "medium",
};

const STORAGE_KEY = "gitk-rs-settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Merge with defaults so new fields are always present
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage not available (e.g. private mode)
  }
}
