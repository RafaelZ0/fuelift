"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo, Opcoes } from "@/components/ui";
import { copiarRefeicao, type Estado } from "../actions";

export function FormCopiar({
  paraData,
  paraRefeicao,
  deData,
  opcoes,
}: {
  paraData: string;
  paraRefeicao: string;
  deData: string;
  maxData: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
}) {
  const [estado, acao] = useActionState<Estado, FormData>(copiarRefeicao, {});
  return (
    <form action={acao} className="space-y-8" noValidate>
      <input type="hidden" name="paraData" value={paraData} />
      <input type="hidden" name="paraRefeicao" value={paraRefeicao} />
      <Campo nome="deData" rotulo="Copiar do dia" tipo="date" valor={deData} erro={estado.erros?.deData} />
      <Opcoes nome="deRefeicao" rotulo="Da refeição" opcoes={opcoes} valor={paraRefeicao} erro={estado.erros?.deRefeicao} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar pendente="Copiando…">Copiar</BotaoEnviar>
    </form>
  );
}
