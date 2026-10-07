"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar } from "@/components/ui";
import { usarRefeicaoSalva, type Estado } from "../actions";

export function UsarRefeicao({ refeicaoSalvaId, data, refeicao, rotulo }: { refeicaoSalvaId: string; data: string; refeicao: string; rotulo: string }) {
  const [estado, acao] = useActionState<Estado, FormData>(usarRefeicaoSalva, {});
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="refeicaoSalvaId" value={refeicaoSalvaId} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="refeicao" value={refeicao} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar pendente="Adicionando…">{rotulo}</BotaoEnviar>
    </form>
  );
}
