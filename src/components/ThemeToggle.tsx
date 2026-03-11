import { useSettings } from "../context/SettingsContext";

export default function ThemeToggle() {
  const { settings, updateSettings } = useSettings();

  const toggleTheme = () => {
    const newTheme = settings.theme === "light" ? "dark" : "light";
    updateSettings({ theme: newTheme });
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={`Switch to ${settings.theme === "light" ? "dark" : "light"} theme`}
    >
      {settings.theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}

