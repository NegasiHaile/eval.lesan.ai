"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type PreferencesContextType = {
  showTooltips: boolean;
  setShowTooltips: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [showTooltips, setShowTooltipsState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("show_tooltips");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("show_tooltips", String(showTooltips));
  }, [showTooltips]);

  const setShowTooltips = (value: boolean) => {
    setShowTooltipsState(value);
  };

  return (
    <PreferencesContext.Provider
      value={{ showTooltips, setShowTooltips }}
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
