"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { adicionarExercicioAoTreino, salvarPlano, salvarTreino, type EstadoTreino } from "../actions";

export type ValoresPlano = { id: string; nome: string; inicio: string; seriesInicio: string; seriesDepois: string; semanasInicio: string };

export function FormPlano({ hoje, valores }: { hoje: string; valores?: ValoresPlano }) {
  const [estado, acao] = useActionState<EstadoTreino, FormData>(salvarPlano, {});
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="space-y-8" noValidate>
      {valores ? <input type="hidden" name="planoId" value={valores.id} /> : null}
      <Campo nome="nome" rotulo="Nome do plano" maxLength={80} valor={valores?.nome} erro={e.nome} />
      <Campo nome="inicio" rotulo="Início do plano" tipo="date" valor={valores?.inicio ?? hoje} erro={e.inicio} />
      <div className="grid grid-cols-3 gap-4">
        <Campo nome="seriesInicio" rotulo="Séries no início" teclado="numeric" maxLength={2} valor={valores?.seriesInicio ?? "2"} erro={e.seriesInicio} />
        <Campo nome="semanasInicio" rotulo="Semanas assim" teclado="numeric" maxLength={2} valor={valores?.semanasInicio ?? "3"} erro={e.semanasInicio} />
        <Campo nome="seriesDepois" rotulo="Séries depois" teclado="numeric" maxLength={2} valor={valores?.seriesDepois ?? "3"} erro={e.seriesDepois} />
      </div>
      <p className="-mt-4 text-sm text-suave">Readaptação: poucas séries nas primeiras semanas e mais depois. Cada exercício pode ter as suas.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>{valores ? "Salvar plano" : "Criar plano"}</BotaoEnviar>
    </form>
  );
}

export function FormTreino({ treinoId, nome, foco }: { treinoId?: string; nome?: string; foco?: string }) {
  const [estado, acao] = useActionState<EstadoTreino, FormData>(salvarTreino, {});
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="space-y-6" noValidate>
      {treinoId ? <input type="hidden" name="treinoId" value={treinoId} /> : null}
      <Campo nome="nome" rotulo="Nome do treino" maxLength={60} valor={nome} erro={e.nome} dica="Ex.: Dia 1 – superiores (empurrar)" />
      <Campo nome="foco" rotulo="Foco (opcional)" maxLength={120} valor={foco} erro={e.foco} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>{treinoId ? "Salvar treino" : "Adicionar treino"}</BotaoEnviar>
    </form>
  );
}

export function FormItem({ treinoId, exercicios }: { treinoId: string; exercicios: Array<{ id: string; nome: string }> }) {
  const [estado, acao] = useActionState<EstadoTreino, FormData>(adicionarExercicioAoTreino, {});
  const e = estado.erros ?? {};
  if (exercicios.length === 0) return <p className="text-sm text-suave">Cadastre exercícios primeiro (botão &quot;Exercícios&quot; na aba Treino).</p>;
  return (
    <form action={acao} className="space-y-6" noValidate>
      <input type="hidden" name="treinoId" value={treinoId} />
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Exercício</span>
        <select name="exercicioId" className="min-h-12 w-full rounded-xl border-2 border-borda bg-superficie px-3 text-lg font-semibold">
          {exercicios.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        {e.exercicioId ? <span className="mt-1 block text-sm text-erro"><span aria-hidden="true">⚠ </span>{e.exercicioId}</span> : null}
      </label>
      <div className="grid grid-cols-2 gap-4">
        <Campo nome="repsMin" rotulo="Repetições (mín.)" teclado="numeric" maxLength={4} valor="8" erro={e.repsMin} />
        <Campo nome="repsMax" rotulo="Repetições (máx.)" teclado="numeric" maxLength={4} valor="12" erro={e.repsMax} />
        <Campo nome="series" rotulo="Séries (vazio = fase)" teclado="numeric" maxLength={2} erro={e.series} />
        <Campo nome="descansoS" rotulo="Descanso (s)" teclado="numeric" maxLength={3} valor="90" erro={e.descansoS} />
      </div>
      <Campo nome="observacao" rotulo="Observação (opcional)" maxLength={300} erro={e.observacao} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>Adicionar exercício</BotaoEnviar>
    </form>
  );
}
