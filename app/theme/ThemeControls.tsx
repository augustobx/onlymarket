"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/icons";
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="nl-palette-wrap" ref={ref}>
      <button
        type="button"
        className="nl-iconbtn"
        aria-label="Selector de paleta"
        aria-expanded={open}
        title="Elegir paleta corporativa"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nl-swatch" style={{ background: palette.gradient }} />
        <span className="nl-palette-label">{palette.badge}</span>
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="nl-palette-menu" role="menu">
          <div className="nl-palette-head">
            <strong>Paleta corporativa</strong>
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
              {p.id === palette.id && (
                <span className="nl-check">
                  <Icon name="check" size={14} />
                </span>
              )}
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
      className="nl-iconbtn nl-iconbtn--square"
      onClick={toggleDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      <Icon name={isDark ? "sun" : "moon"} size={16} />
    </button>
  );
}
