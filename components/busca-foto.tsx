"use client";

import { useState, useTransition } from "react";
import { BotaoSecundario } from "@/components/ui";
import { FotoExercicio } from "@/components/foto-exercicio";
import { CREDITO_FOTOS, urlFoto } from "@/lib/fotos";
import { buscarFotoNoCatalogo } from "@/app/(app)/treino/ia/actions";

/** Busca de foto no catálogo (Free Exercise DB). O usuário digita em português ou inglês e escolhe. */
export function BuscaFoto({ fotoId, fotoNome, nome, termoInicial, aoEscolher }: { fotoId: string | null; fotoNome: string | null; nome: string; termoInicial: string; aoEscolher: (id: string | null, nome: string | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState(termoInicial);
  const [resultados, setResultados] = useState<Array<{ id: string; nomeEn: string; equipamento: string | null }> | null>(null);
  const [buscando, iniciar] = useTransition();

  function buscar() {
    iniciar(async () => setResultados(await buscarFotoNoCatalogo(termo)));
  }

  return (
    <div className="space-y-3">
      {fotoId ? (
        <>
          <FotoExercicio fotoId={fotoId} nome={fotoNome ?? nome} />
          <p className="text-sm text-suave">Foto: {fotoNome}</p>
        </>
      ) : (
        <p className="text-sm text-suave">Sem foto.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <BotaoSecundario onClick={() => setAberto((a) => !a)}>{aberto ? "Fechar busca" : fotoId ? "Trocar foto" : "Buscar foto"}</BotaoSecundario>
        {fotoId ? <BotaoSecundario onClick={() => aoEscolher(null, null)}>Tirar foto</BotaoSecundario> : null}
      </div>
      {aberto ? (
        <div className="space-y-3 rounded-2xl border-2 border-borda p-3">
          <div className="flex gap-2">
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
              maxLength={60}
              aria-label="Buscar exercício (português ou inglês)"
              className="min-h-12 min-w-0 flex-1 border-b-2 border-borda bg-transparent text-lg outline-none focus:border-marca"
            />
            <BotaoSecundario onClick={buscar}>{buscando ? "Buscando…" : "Buscar"}</BotaoSecundario>
          </div>
          {resultados && resultados.length === 0 ? <p className="text-suave">Nada encontrado. Tente outro nome (pode ser em inglês).</p> : null}
          <ul className="space-y-2">
            {(resultados ?? []).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { aoEscolher(r.id, r.nomeEn); setAberto(false); }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-borda p-2 text-left active:border-marca"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(r.id, 0) ?? ""} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-lg bg-superficie object-cover" />
                  <span className="font-semibold">{r.nomeEn}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-suave">{CREDITO_FOTOS}</p>
        </div>
      ) : null}
    </div>
  );
}
