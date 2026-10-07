"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { salvarAlimento, type Estado } from "../actions";

export type ValoresAlimento = {
  nome: string;
  marca: string;
  porcaoG: string;
  kcal: string;
  proteinaG: string;
  carboG: string;
  gorduraG: string;
  fibraG: string;
  sodioMg: string;
};

/** Cadastro pelo rótulo: valores da porção do rótulo (qualquer gramagem). O servidor converte para 100 g. */
export function FormAlimento({
  alimentoId,
  valores,
  data,
  refeicao,
}: {
  alimentoId?: string;
  valores?: ValoresAlimento;
  data?: string;
  refeicao?: string;
}) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarAlimento, {});
  const e = estado.erros ?? {};
  const v = valores;
  return (
    <form action={acao} className="space-y-8" noValidate>
      {alimentoId ? <input type="hidden" name="alimentoId" value={alimentoId} /> : null}
      {data ? <input type="hidden" name="data" value={data} /> : null}
      {refeicao ? <input type="hidden" name="refeicao" value={refeicao} /> : null}
      <Campo nome="nome" rotulo="Nome" maxLength={120} valor={v?.nome} erro={e.nome} />
      <Campo nome="marca" rotulo="Marca (opcional)" maxLength={80} valor={v?.marca} erro={e.marca} />
      <Campo
        nome="porcaoG"
        rotulo="Porção do rótulo"
        teclado="decimal"
        sufixo="g"
        maxLength={7}
        valor={v?.porcaoG ?? "100"}
        erro={e.porcaoG}
        dica="Use a porção que aparece na tabela do rótulo (ex.: 30 g). Os valores abaixo são dessa porção."
      />
      <Campo nome="kcal" rotulo="Calorias" teclado="decimal" sufixo="kcal" maxLength={7} valor={v?.kcal} erro={e.kcal} />
      <div className="grid grid-cols-2 gap-6">
        <Campo nome="proteinaG" rotulo="Proteína" teclado="decimal" sufixo="g" maxLength={5} valor={v?.proteinaG} erro={e.proteinaG} />
        <Campo nome="carboG" rotulo="Carboidrato" teclado="decimal" sufixo="g" maxLength={5} valor={v?.carboG} erro={e.carboG} />
        <Campo nome="gorduraG" rotulo="Gordura total" teclado="decimal" sufixo="g" maxLength={5} valor={v?.gorduraG} erro={e.gorduraG} />
        <Campo nome="fibraG" rotulo="Fibra" teclado="decimal" sufixo="g" maxLength={5} valor={v?.fibraG} erro={e.fibraG} />
      </div>
      <Campo nome="sodioMg" rotulo="Sódio (opcional)" teclado="decimal" sufixo="mg" maxLength={8} valor={v?.sodioMg} erro={e.sodioMg} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>{alimentoId ? "Salvar alterações" : "Cadastrar alimento"}</BotaoEnviar>
    </form>
  );
}
