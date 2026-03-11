import { createContext, ReactNode, useContext } from "react";
import { AppViewModel, useAppViewModel } from "../viewmodels/useAppViewModel";

const AppContext = createContext<AppViewModel | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const viewModel = useAppViewModel();
  return <AppContext.Provider value={viewModel}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppViewModel {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
