"use client";

import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar, BotaoSecundario } from "@/components/ui";
import { AVISO_ESTIMATIVA } from "@/lib/ia/prompts";
import type { ExercicioRascunho, Rascunho } from "@/lib/ia/rascunho";
import { BuscaFoto } from "@/components/busca-foto";
import { salvarRascunhoIa, type EstadoIa } from "./actions";

function Passo({ rotulo, valor, onMenos, onMais, sufixo = "" }: { rotulo: string; valor: string; onMenos: () => void; onMais: () => void; sufixo?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-suave">{rotulo}</span>
      <span className="flex items-center gap-3">
        <button type="button" onClick={onMenos} aria-label={`Diminuir ${rotulo}`} className="size-12 rounded-full border-2 border-borda text-2xl font-bold">−</button>
        <span className="min-w-16 text-center text-lg font-bold">{valor}{sufixo}</span>
        <button type="button" onClick={onMais} aria-label={`Aumentar ${rotulo}`} className="size-12 rounded-full border-2 border-borda text-2xl font-bold">+</button>
      </span>
    </div>
  );
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function EditorRascunho({ inicial, descartados, onCancelar }: { inicial: Rascunho; descartados: number; onCancelar: () => void }) {
  const [r, setR] = useState<Rascunho>(inicial);
  const [estado, acao] = useActionState<EstadoIa, FormData>(salvarRascunhoIa, {});

  const mudarExercicio = (ti: number, ei: number, parte: Partial<ExercicioRascunho>) =>
    setR((a) => ({ ...a, treinos: a.treinos.map((t, i) => (i !== ti ? t : { ...t, exercicios: t.exercicios.map((e, j) => (j !== ei ? e : { ...e, ...parte })) })) }));
  const removerExercicio = (ti: number, ei: number) =>
    setR((a) => ({
      ...a,
      treinos: a.treinos.map((t, i) => (i !== ti ? t : { ...t, exercicios: t.exercicios.filter((_, j) => j !== ei) })).filter((t) => t.exercicios.length > 0),
    }));
  const removerTreino = (ti: number) => setR((a) => ({ ...a, treinos: a.treinos.filter((_, i) => i !== ti) }));

  return (
    <form action={acao} className="space-y-10" noValidate>
      <input type="hidden" name="rascunho" value={JSON.stringify(r)} />
      <p className="rounded-2xl border-2 border-aviso p-4 font-medium text-aviso">
        <span aria-hidden="true">! </span>
        {AVISO_ESTIMATIVA}
      </p>
      {r.alertas.length > 0 ? (
        <ul className="space-y-2" aria-label="Alertas">
          {r.alertas.map((a, i) => (
            <li key={i} className="rounded-2xl border-2 border-aviso p-3 text-aviso"><span aria-hidden="true">! </span>{a}</li>
          ))}
        </ul>
      ) : null}
      {descartados > 0 ? <p className="text-sm text-suave">A IA devolveu {descartados} {descartados === 1 ? "item fora do padrão, que foi ignorado" : "itens fora do padrão, que foram ignorados"}.</p> : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Nome do plano</span>
        <input value={r.nome} maxLength={80} onChange={(e) => setR({ ...r, nome: e.target.value })} className="min-h-12 w-full border-b-2 border-borda bg-transparent py-2 text-xl font-semibold outline-none focus:border-marca" />
      </label>

      {r.treinos.map((t, ti) => (
        <section key={ti} aria-label={`Treino ${t.nome}`} className="space-y-6">
          <div className="flex items-start gap-3">
            <label className="block flex-1">
              <span className="mb-2 block text-sm font-medium text-suave">Treino {ti + 1}</span>
              <input
                value={t.nome}
                maxLength={60}
                onChange={(e) => setR((a) => ({ ...a, treinos: a.treinos.map((x, i) => (i === ti ? { ...x, nome: e.target.value } : x)) }))}
                className="min-h-12 w-full border-b-2 border-borda bg-transparent py-2 text-2xl font-bold outline-none focus:border-marca"
              />
            </label>
            {r.treinos.length > 1 ? <BotaoSecundario onClick={() => removerTreino(ti)}>Remover</BotaoSecundario> : null}
          </div>

          <ol className="space-y-8">
            {t.exercicios.map((e, ei) => (
              <li key={ei} className="space-y-4 rounded-2xl border-2 border-linha p-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-suave">Exercício</span>
                  <input value={e.nomePt} maxLength={80} onChange={(ev) => mudarExercicio(ti, ei, { nomePt: ev.target.value })} className="min-h-12 w-full border-b-2 border-borda bg-transparent py-1 text-lg font-bold outline-none focus:border-marca" />
                </label>
                <Passo rotulo="Séries" valor={e.series === null ? "Plano" : String(e.series)} onMenos={() => mudarExercicio(ti, ei, { series: e.series === null || e.series <= 1 ? null : e.series - 1 })} onMais={() => mudarExercicio(ti, ei, { series: limitar((e.series ?? 0) + 1, 1, 10) })} />
                <Passo rotulo={e.medida === "segundos" ? "Mínimo" : "Reps mín."} valor={String(e.repsMin)} sufixo={e.medida === "segundos" ? " s" : ""} onMenos={() => mudarExercicio(ti, ei, { repsMin: limitar(e.repsMin - 1, 1, e.repsMax) })} onMais={() => mudarExercicio(ti, ei, { repsMin: limitar(e.repsMin + 1, 1, e.repsMax) })} />
                <Passo rotulo={e.medida === "segundos" ? "Máximo" : "Reps máx."} valor={String(e.repsMax)} sufixo={e.medida === "segundos" ? " s" : ""} onMenos={() => mudarExercicio(ti, ei, { repsMax: limitar(e.repsMax - 1, e.repsMin, 100) })} onMais={() => mudarExercicio(ti, ei, { repsMax: limitar(e.repsMax + 1, e.repsMin, 100) })} />
                <Passo rotulo="Descanso" valor={String(e.descansoS)} sufixo=" s" onMenos={() => mudarExercicio(ti, ei, { descansoS: limitar(e.descansoS - 15, 0, 300) })} onMais={() => mudarExercicio(ti, ei, { descansoS: limitar(e.descansoS + 15, 0, 300) })} />
                {e.observacao ? <p className="text-sm text-suave">{e.observacao}</p> : null}
                <BuscaFoto fotoId={e.fotoId} fotoNome={e.fotoNome} nome={e.nomePt} termoInicial={e.nomeEn || e.nomePt} aoEscolher={(id, nome) => mudarExercicio(ti, ei, { fotoId: id, fotoNome: nome })} />
                <BotaoSecundario onClick={() => removerExercicio(ti, ei)}>Remover exercício</BotaoSecundario>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="text-sm text-suave">Ao salvar, este vira o seu plano ativo (o anterior fica guardado) e os treinos entram na agenda nos dias sugeridos. Você pode mudar tudo depois em Plano.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar>Confirmar e salvar plano</BotaoEnviar>
      <BotaoSecundario onClick={onCancelar}>Descartar rascunho</BotaoSecundario>
    </form>
  );
}
