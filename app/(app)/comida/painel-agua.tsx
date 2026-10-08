"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { Barra } from "@/components/graficos";
import { BOTOES_AGUA } from "@/lib/treino";
import { adicionarAgua, adicionarAguaLivre, desfazerAgua, type EstadoAgua } from "./agua";

export function PainelAgua({ data, totalMl, metaMl, editavel }: { data: string; totalMl: number; metaMl: number | null; editavel: boolean }) {
  const [estado, acaoLivre] = useActionState<EstadoAgua, FormData>(adicionarAguaLivre, {});
  const pct = metaMl ? (totalMl / metaMl) * 100 : 0;
  const litros = (ml: number) => (ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  return (
    <section aria-labelledby="agua" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="agua" className="text-2xl font-bold">Água</h2>
        <span className="font-semibold">
          {litros(totalMl)} L{metaMl ? <span className="text-suave"> / {litros(metaMl)} L</span> : null}
        </span>
      </div>
      {metaMl ? <Barra percentual={pct} /> : <p className="text-sm text-suave">Defina a meta de água em Ajustes.</p>}
      {editavel ? (
        <>
          <form action={adicionarAgua} className="grid grid-cols-3 gap-3">
            <input type="hidden" name="data" value={data} />
            {BOTOES_AGUA.map((ml) => (
              <button key={ml} type="submit" name="ml" value={ml} className="min-h-14 rounded-full border-2 border-linha text-lg font-bold active:border-destaque">
                +{ml}
              </button>
            ))}
          </form>
          <form action={acaoLivre} className="flex items-end gap-3" noValidate>
            <input type="hidden" name="data" value={data} />
            <div className="flex-1">
              <Campo nome="ml" rotulo="Outro valor" teclado="numeric" sufixo="ml" maxLength={4} erro={estado.erros?.ml} />
            </div>
            <div className="w-32">
              <BotaoEnviar pendente="…">Somar</BotaoEnviar>
            </div>
          </form>
          {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
          {totalMl > 0 ? (
            <form action={desfazerAgua}>
              <input type="hidden" name="data" value={data} />
              <button type="submit" className="min-h-11 text-sm font-semibold text-suave underline">
                Desfazer o último
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
