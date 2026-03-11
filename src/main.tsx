import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { SettingsProvider } from "./context/SettingsContext";
import { loadSettings } from "./types/settings";
import "./styles/App.css";

// Apply persisted theme immediately so there's no flash on load.
if (typeof document !== "undefined") {
  const saved = loadSettings();
  document.documentElement.setAttribute("data-theme", saved.theme);
  document.documentElement.setAttribute("data-font-size", saved.fontSize);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </SettingsProvider>
  </React.StrictMode>
);

