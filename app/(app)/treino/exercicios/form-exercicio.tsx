"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo, Opcoes } from "@/components/ui";
import { salvarExercicio, type EstadoTreino } from "../actions";

export type ValoresExercicio = { id: string; nome: string; grupo: string; unilateral: boolean; cargaPorHalter: boolean; medida: string; fotoId: string };

function Caixa({ nome, rotulo, marcada }: { nome: string; rotulo: string; marcada?: boolean }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3">
      <input type="checkbox" name={nome} defaultChecked={marcada} className="h-6 w-6 accent-destaque" />
      <span className="font-semibold">{rotulo}</span>
    </label>
  );
}

export function FormExercicio({ valores }: { valores?: ValoresExercicio }) {
  const [estado, acao] = useActionState<EstadoTreino, FormData>(salvarExercicio, {});
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="space-y-8" noValidate>
      {valores ? <input type="hidden" name="exercicioId" value={valores.id} /> : null}
      <Campo nome="nome" rotulo="Nome" maxLength={80} valor={valores?.nome} erro={e.nome} />
      <Campo nome="grupo" rotulo="Grupo muscular (opcional)" maxLength={40} valor={valores?.grupo} erro={e.grupo} />
      <Opcoes
        nome="medida"
        rotulo="Medido em"
        valor={valores?.medida ?? "repeticoes"}
        opcoes={[{ valor: "repeticoes", rotulo: "Repetições" }, { valor: "segundos", rotulo: "Segundos" }]}
        erro={e.medida}
      />
      <div>
        <Caixa nome="unilateral" rotulo="Unilateral (um lado por vez)" marcada={valores?.unilateral} />
        <Caixa nome="cargaPorHalter" rotulo="Carga por halter (cada halter)" marcada={valores?.cargaPorHalter} />
      </div>
      <Campo
        nome="fotoId"
        rotulo="Foto: id do Free Exercise DB (opcional)"
        maxLength={120}
        valor={valores?.fotoId}
        erro={e.fotoId}
        dica="Ex.: Barbell_Squat. Veja o nome em github.com/yuhonas/free-exercise-db (pasta exercises)."
      />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>{valores ? "Salvar alterações" : "Criar exercício"}</BotaoEnviar>
    </form>
  );
}
