export type ThemeName =
  | "dark"
  | "light"
  | "midnight"
  | "forest"
  | "ocean"
  | "solarized-dark"
  | "solarized-light"
  | "dracula"
  | "high-contrast-dark"
  | "high-contrast-light";

export interface ThemeOption {
  value: ThemeName;
  label: string;
  description: string;
  highContrast?: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: "dark", label: "Dark", description: "Balanced low-light theme" },
  { value: "light", label: "Light", description: "Neutral daylight theme" },
  { value: "midnight", label: "Midnight", description: "Deep blue workspace" },
  { value: "forest", label: "Forest", description: "Calm green console tone" },
  { value: "ocean", label: "Ocean", description: "Cool cyan coding palette" },
  { value: "solarized-dark", label: "Solarized Dark", description: "Low-contrast dark classic" },
  { value: "solarized-light", label: "Solarized Light", description: "Low-glare light classic" },
  { value: "dracula", label: "Dracula", description: "Vibrant dark coding palette" },
  {
    value: "high-contrast-dark",
    label: "High Contrast Dark",
    description: "Maximum contrast for readability",
    highContrast: true,
  },
  {
    value: "high-contrast-light",
    label: "High Contrast Light",
    description: "Maximum contrast bright mode",
    highContrast: true,
  },
];

const THEME_VALUES = new Set<ThemeName>(THEME_OPTIONS.map((theme) => theme.value));

export interface AppSettings {
  /** UI color theme */
  theme: ThemeName;
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

function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && THEME_VALUES.has(value as ThemeName);
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const theme = isThemeName(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme;
    // Merge with defaults so new fields are always present
    return { ...DEFAULT_SETTINGS, ...parsed, theme };
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
