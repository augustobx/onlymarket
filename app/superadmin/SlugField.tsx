"use client";

import { useEffect, useRef, useState } from "react";

type CheckState = {
  checking: boolean;
  available: boolean | null;
  fqdn: string;
  reason: string;
  warning?: string;
};

export function SlugField({ baseDomain, scheme }: { baseDomain: string; scheme: string }) {
  const [value, setValue] = useState("");
  const requestId = useRef(0);
  const [state, setState] = useState<CheckState>({
    checking: false,
    available: null,
    fqdn: "",
    reason: "",
  });

  const clean = value.trim().toLowerCase();

  const runCheck = async (target: string) => {
    const id = ++requestId.current;
    const normalized = target.trim().toLowerCase();
    if (!normalized) {
      setState({ checking: false, available: null, fqdn: "", reason: "" });
      return;
    }
    setState((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch(`/superadmin/api/slug-check?slug=${encodeURIComponent(normalized)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (id !== requestId.current) return;
      setState({
        checking: false,
        available: Boolean(data.available),
        fqdn: data.fqdn || `${normalized}.${baseDomain}`,
        reason: data.reason || "",
        warning: data.warning || "",
      });
    } catch {
      if (id !== requestId.current) return;
      setState({
        checking: false,
        available: null,
        fqdn: `${normalized}.${baseDomain}`,
        reason: "No se pudo consultar la disponibilidad.",
      });
    }
  };

  useEffect(() => {
    if (!clean) {
      setState({ checking: false, available: null, fqdn: "", reason: "" });
      return;
    }
    const timer = setTimeout(() => {
      void runCheck(clean);
    }, 350);
    return () => { clearTimeout(timer); requestId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean]);

  return (
    <div className="slugfield">
      <label htmlFor="create-tenant-slug">
        Subdominio de acceso
        <div className="sluginput-row">
          <input
            id="create-tenant-slug"
            name="slug"
            required
            minLength={2}
            maxLength={63}
            pattern={String.raw`[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]`}
            placeholder="ej. mercado-central"
            value={value}
            onChange={(e) => {
              requestId.current++;
              setState({ checking: false, available: null, fqdn: "", reason: "" });
              setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
          />
          <span className="slug-suffix">.{baseDomain}</span>
          <button
            type="button"
            className="secondary slug-check-btn"
            onClick={() => void runCheck(value)}
            disabled={!clean || state.checking}
          >
            {state.checking ? "Verificando..." : "Verificar"}
          </button>
        </div>
      </label>
      {clean && (
        <small className="slug-hint">
          URL del comercio: <code>{scheme}://{clean}.{baseDomain}</code>
          {" · "}
          {state.checking && <span>Comprobando colisiones...</span>}
          {!state.checking && state.available === true && (
            <span className="slug-ok">Disponible{state.warning ? ` (${state.warning})` : ""}</span>
          )}
          {!state.checking && state.available === false && (
            <span className="slug-bad">{state.reason || "No disponible"}</span>
          )}
        </small>
      )}
    </div>
  );
}
