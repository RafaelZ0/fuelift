"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo, Opcoes } from "@/components/ui";
import { MOTIVOS, ROTULOS_MOTIVO } from "@/lib/validacao/treino";
import { registrarFaltaDoDia, type EstadoTreino } from "../actions";

export function FormFalta({ data, treinoId }: { data: string; treinoId: string }) {
  const [estado, acao] = useActionState<EstadoTreino, FormData>(registrarFaltaDoDia, {});
  return (
    <form action={acao} className="space-y-8" noValidate>
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="treinoId" value={treinoId} />
      <Opcoes nome="motivo" rotulo="Motivo" opcoes={MOTIVOS.map((m) => ({ valor: m, rotulo: ROTULOS_MOTIVO[m] }))} erro={estado.erros?.motivo} />
      <Campo nome="observacao" rotulo="Observação (opcional)" maxLength={500} erro={estado.erros?.observacao} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="Salvando…">Registrar falta</BotaoEnviar>
    </form>
  );
}
