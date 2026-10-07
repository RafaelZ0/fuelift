"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AlimentoResumo } from "@/lib/dal/alimentos";
import { BUSCA_MAX, BUSCA_MIN } from "@/lib/busca";
import { buscar } from "../actions";
import { ListaAlimentos } from "../comum";

/** Campo de busca: mostra os favoritos/recentes (children) até o usuário digitar. */
export function Busca({ volta, children }: { volta: string; children: React.ReactNode }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<AlimentoResumo[] | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [buscando, iniciar] = useTransition();
  const ultimo = useRef(0);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < BUSCA_MIN) return;
    const pedido = ++ultimo.current;
    const espera = setTimeout(() => {
      iniciar(async () => {
        const r = await buscar(t);
        if (pedido !== ultimo.current) return; // resposta antiga
        setResultados(r.resultados);
        setErro(r.erro);
      });
    }, 300);
    return () => clearTimeout(espera);
  }, [termo]);

  const mostrandoBusca = termo.trim().length >= BUSCA_MIN;

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="sr-only">Buscar alimento</span>
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value.slice(0, BUSCA_MAX))}
          placeholder="Buscar alimento"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-14 w-full rounded-2xl border-2 border-linha bg-superficie px-4 text-lg font-semibold outline-none placeholder:text-suave focus:border-destaque"
        />
      </label>
      {mostrandoBusca ? (
        <section aria-live="polite" className="space-y-2">
          {erro ? <p className="text-erro">{erro}</p> : null}
          {buscando && !resultados ? <p className="text-suave">Buscando…</p> : null}
          {resultados && resultados.length === 0 && !erro ? (
            <p className="text-suave">Nada encontrado. Tente outra palavra ou cadastre pelo rótulo.</p>
          ) : null}
          {resultados && resultados.length > 0 ? <ListaAlimentos itens={resultados} volta={volta} /> : null}
        </section>
      ) : (
        children
      )}
    </div>
  );
}
