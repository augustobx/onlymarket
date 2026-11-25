"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyPaletteToDOM, DEFAULT_PALETTE_ID, getPalette, PALETTES, type ColorPalette } from "./palettes";

interface ThemeContextValue {
  palette: ColorPalette;
  setPalette: (id: string) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  palette: PALETTES[DEFAULT_PALETTE_ID],
  setPalette: () => {},
  isDark: false,
  toggleDark: () => {},
});

export const useNanoLabsTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>(PALETTES[DEFAULT_PALETTE_ID]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedPalette = localStorage.getItem("onlymarket_palette") ?? DEFAULT_PALETTE_ID;
    const pal = getPalette(savedPalette);
    setPaletteState(pal);
    const savedDark =
      document.documentElement.getAttribute("data-theme") === "dark" ||
      localStorage.getItem("nl-theme") === "dark";
    setIsDark(savedDark);
    document.documentElement.setAttribute("data-theme", savedDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", savedDark);
    applyPaletteToDOM(pal, savedDark);
  }, []);

  const setPalette = (id: string) => {
    const pal = getPalette(id);
    setPaletteState(pal);
    localStorage.setItem("onlymarket_palette", pal.id);
    document.cookie = `onlymarket_palette=${pal.id}; path=/; max-age=31536000; SameSite=Lax`;
    applyPaletteToDOM(pal, isDark);
  };

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    const val = next ? "dark" : "light";
    localStorage.setItem("nl-theme", val);
    document.documentElement.setAttribute("data-theme", val);
    document.documentElement.classList.toggle("dark", next);
    applyPaletteToDOM(palette, next);
  };

  return (
    <ThemeContext.Provider value={{ palette, setPalette, isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
