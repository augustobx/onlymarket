"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { crearCielo } from "./cielo";
import { crearEscena, type Fase } from "./particulas";
import { NanoLabsMark } from "./NanoLabsMark";
import "./login.css";

const quietoDelSistema = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function SpaceLogin({
  area,
  producto,
  bajada,
  tituloTarjeta,
  subtituloTarjeta,
  pieTarjeta,
  children,
}: {
  area: string;
  producto: string;
  bajada: string;
  tituloTarjeta: string;
  subtituloTarjeta: string;
  pieTarjeta?: ReactNode;
  children: ReactNode;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const cielo = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<Fase>("caos");
  const [quieto] = useState(quietoDelSistema);

  useEffect(() => {
    if (!lienzo.current) return;
    const escena = crearEscena(lienzo.current, {
      logoUrl: "/nanolabs/logo-nanolabs.svg",
      quieto,
      onFase: setFase,
    });
    return () => escena.destruir();
  }, [quieto]);

  useEffect(() => {
    if (!cielo.current) return;
    const c = crearCielo(cielo.current, quieto);
    return () => c.destruir();
  }, [quieto]);

  return (
    <div className="bhi bh2 bh3">
      <div className="bh2-fondo" aria-hidden="true" />
      <canvas ref={cielo} className="bh2-lienzo" aria-hidden="true" />
      <canvas ref={lienzo} className="bh2-lienzo" aria-hidden="true" />
      <div className="bh2-vineta" aria-hidden="true" />

      <header className="bh2-arriba">
        <span className="bh2-marca__area">{area}</span>
      </header>

      {fase === "producto" && (
        <div className="bh3-nombre" aria-hidden="true">
          <p className="bh3-nombre__titulo">{producto}</p>
          <p className="bh3-nombre__bajada">{bajada}</p>
        </div>
      )}

      <main className="bh2-tarjeta">
        <div className="bh2-tarjeta__cuerpo">
          <div className="bh2-tarjeta__cabeza">
            <div className="bh2-tarjeta__tile" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l1-5h16l1 5" />
                <path d="M4 9v11h16V9" />
                <path d="M9 20v-6h6v6" />
                <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
              </svg>
            </div>
            <div>
              <p className="bh2-tarjeta__brand">{producto}</p>
              <span className="bh2-tarjeta__subbrand">NanoLabs Retail &amp; Fresh Cloud</span>
            </div>
          </div>
          <h1 className="bh2-tarjeta__titulo">{tituloTarjeta}</h1>
          <p className="bh2-tarjeta__bajada">{subtituloTarjeta}</p>
          {children}
          <p className="bh2-seguro">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Acceso cifrado · Sesión aislada por comercio
          </p>
        </div>
        <div className="bh2-tarjeta__pie">
          {pieTarjeta ?? <span>Soporte operativo: consultá con el administrador de tu comercio.</span>}
        </div>
      </main>

      <div className="bh2-relato">
        <p className="bh2-nanolabs">
          <NanoLabsMark size={22} />
          <span>
            Powered by <strong>NanoLabs</strong>
          </span>
        </p>
        <p className="bh2-pie">NanoLabs · Retail &amp; Fresh Commerce · Multi-Tenant Platform</p>
      </div>
    </div>
  );
}
