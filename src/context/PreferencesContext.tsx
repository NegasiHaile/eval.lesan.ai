"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

type PreferencesContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  showTooltips: boolean;
  setShowTooltips: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme;
      return stored || "system";
    }
    return "system";
  });

  const [showTooltips, setShowTooltipsState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("show_tooltips");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("light", "dark");
    if (theme === "light" || theme === "dark") {
      document.documentElement.classList.add(theme);
    } else {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      document.documentElement.classList.add(systemTheme);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const setShowTooltips = (value: boolean) => {
    setShowTooltipsState(value);
    localStorage.setItem("show_tooltips", String(value));
  };

  return (
    <PreferencesContext.Provider
      value={{ theme, setTheme, showTooltips, setShowTooltips }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
};
