"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTES } from "./palettes";
import { useNanoLabsTheme } from "./ThemeProvider";

export function PaletteSelector() {
  const { palette, setPalette } = useNanoLabsTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="nl-palette-wrap" ref={ref}>
      <button
        type="button"
        className="nl-iconbtn"
        aria-label="Selector de paleta"
        aria-expanded={open}
        title="Elegir paleta de color"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nl-swatch" style={{ background: palette.gradient }} />
        <span className="nl-palette-label">{palette.badge}</span>
      </button>
      {open && (
        <div className="nl-palette-menu" role="menu">
          <div className="nl-palette-head">
            <strong>Paleta NanoLabs</strong>
          </div>
          {Object.values(PALETTES).map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === palette.id}
              className={`nl-palette-item${p.id === palette.id ? " active" : ""}`}
              onClick={() => {
                setPalette(p.id);
                setOpen(false);
              }}
            >
              <span className="nl-swatch" style={{ background: p.gradient }} />
              <span>{p.name}</span>
              {p.id === palette.id && <span className="nl-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DarkModeToggle() {
  const { isDark, toggleDark } = useNanoLabsTheme();
  return (
    <button
      type="button"
      className="nl-iconbtn"
      onClick={toggleDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
