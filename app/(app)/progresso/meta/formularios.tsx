"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import {
  aplicarOpcaoMeta,
  explicarOpcaoMeta,
  salvarPesoMeta,
  salvarRitmoMax,
  type EstadoExplicacao,
  type EstadoMeta,
} from "./actions";

export function FormPesoMeta({ pesoMeta, dataMeta }: { pesoMeta: string; dataMeta: string }) {
  const [estado, acao] = useActionState<EstadoMeta, FormData>(salvarPesoMeta, {});
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="space-y-6" noValidate>
      <Campo nome="pesoMetaKg" rotulo="Peso desejado" teclado="decimal" sufixo="kg" maxLength={6} valor={pesoMeta} erro={e.pesoMetaKg} />
      <Campo nome="dataMeta" rotulo="Data desejada (opcional)" tipo="date" valor={dataMeta} erro={e.dataMeta} dica="Se informar, o app calcula o ritmo que essa data exigiria." />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>Salvar peso desejado</BotaoEnviar>
    </form>
  );
}

const OPCOES_RITMO = [
  { v: "0.25", r: "0,25% por semana (bem leve)" },
  { v: "0.5", r: "0,5% por semana" },
  { v: "0.75", r: "0,75% por semana" },
  { v: "1", r: "1% por semana (máximo)" },
];

export function FormRitmoMax({ atual }: { atual: number }) {
  const [estado, acao] = useActionState<EstadoMeta, FormData>(salvarRitmoMax, {});
  return (
    <form action={acao} className="space-y-4" noValidate>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Ritmo máximo que aceito (do meu peso)</span>
        <select name="ritmo" defaultValue={String(atual)} className="min-h-12 w-full rounded-xl border-2 border-borda bg-superficie px-3 text-lg font-semibold">
          {OPCOES_RITMO.map((o) => (
            <option key={o.v} value={o.v}>{o.r}</option>
          ))}
        </select>
      </label>
      <p className="text-sm text-suave">O teto de 1% por semana é a referência médica comum e não pode ser aumentado. Você pode escolher um ritmo mais conservador.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>Salvar ritmo máximo</BotaoEnviar>
    </form>
  );
}

export type OpcaoTela = {
  id: "leve" | "moderado" | "firme";
  rotulo: string;
  kcal: number;
  kgSemana: number;
  pctSemana: number;
  deficitDia: number;
  semanas: number | null;
  equilibrio: number | null;
  limitadaPorTmb: boolean;
  recomendada: boolean;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  ehMetaAtual: boolean;
};

const n = (v: number) => v.toLocaleString("pt-BR");
const dec = (v: number) => String(Math.abs(v)).replace(".", ",");

export function CartaoOpcao({ o, tipo, ia }: { o: OpcaoTela; tipo: "perder" | "manter" | "ganhar"; ia: boolean }) {
  const [estado, explicar] = useActionState<EstadoExplicacao, FormData>(explicarOpcaoMeta, {});
  return (
    <li className={`space-y-4 rounded-2xl border-2 p-4 ${o.recomendada ? "border-marca" : "border-linha"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-bold">{o.rotulo}</h3>
        {o.recomendada ? <span className="text-sm font-bold text-marca"><span aria-hidden="true">★ </span>Recomendada</span> : null}
      </div>
      <p className="text-3xl font-black">{n(o.kcal)} <span className="text-lg font-bold text-suave">kcal por dia</span></p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-suave">{tipo === "ganhar" ? "Ganho previsto" : "Perda prevista"}</dt><dd className="font-semibold">≈ {dec(o.kgSemana)} kg por semana</dd></div>
        <div><dt className="text-suave">Do seu peso</dt><dd className="font-semibold">{dec(o.pctSemana)}% por semana</dd></div>
        {o.deficitDia > 0 ? <div><dt className="text-suave">Déficit</dt><dd className="font-semibold">≈ {n(o.deficitDia)} kcal por dia</dd></div> : null}
        <div>
          <dt className="text-suave">Até o peso desejado</dt>
          <dd className="font-semibold">{o.semanas !== null ? `≈ ${o.semanas} semanas` : o.equilibrio !== null ? `estabiliza em ≈ ${dec(o.equilibrio)} kg` : "—"}</dd>
        </div>
        <div className="col-span-2"><dt className="text-suave">Proteína · carboidrato · gordura</dt><dd className="font-semibold">{o.proteinaG} g · {o.carboG} g · {o.gorduraG} g</dd></div>
      </dl>
      {o.limitadaPorTmb ? <p className="text-sm font-medium text-aviso"><span aria-hidden="true">! </span>Limitada para não ficar abaixo da sua taxa metabólica basal estimada.</p> : null}
      <p className="text-xs text-suave">Tudo isso é estimativa: o corpo e o registro de comida variam.</p>

      {estado.explicacao ? (
        <div className="space-y-2 rounded-2xl bg-superficie p-3" aria-live="polite">
          <p className="text-xs font-semibold text-suave">{estado.viaIa ? "Explicação da IA (os números são os do app)" : "Explicação do app"}</p>
          <p>{estado.explicacao.explicacao}</p>
          {estado.explicacao.dicas.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {estado.explicacao.dicas.map((d) => <li key={d}>{d}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}

      <div className="flex flex-col gap-2">
        <form action={explicar}>
          <input type="hidden" name="opcao" value={o.id} />
          <button type="submit" className="min-h-12 w-full rounded-full border-2 border-borda font-semibold">
            {ia ? "Explicar com a IA" : "Explicar esta opção"}
          </button>
        </form>
        <form action={aplicarOpcaoMeta}>
          <input type="hidden" name="opcao" value={o.id} />
          <button type="submit" className="min-h-12 w-full rounded-full bg-destaque font-bold text-sobre-destaque">
            {o.ehMetaAtual ? "Esta já é a sua meta (aplicar de novo)" : "Usar como minha meta"}
          </button>
        </form>
      </div>
    </li>
  );
}
