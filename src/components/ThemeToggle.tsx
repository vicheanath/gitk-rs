import { useSettings } from "../context/SettingsContext";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { settings, updateSettings } = useSettings();
  const isLightMode = settings.theme === "light" || settings.theme === "solarized-light" || settings.theme === "high-contrast-light";

  const toggleTheme = () => {
    const newTheme = isLightMode ? "dark" : "light";
    updateSettings({ theme: newTheme });
  };

  return (
    <button
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)]"
      onClick={toggleTheme}
      title={`Switch to ${isLightMode ? "dark" : "light"} theme`}
    >
      {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

