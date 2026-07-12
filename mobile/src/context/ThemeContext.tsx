import { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type AppTheme } from "../lib/theme";

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<"light" | "dark" | null>(null);

  const isDark = override ? override === "dark" : systemScheme === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  function toggleTheme() {
    setOverride(isDark ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error("useAppTheme must be used within ThemeProvider");
  return context;
}
