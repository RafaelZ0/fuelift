"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { salvarPesagem, type EstadoCorpo } from "./actions";

export function FormPesagem({ hoje, atual }: { hoje: string; atual: { peso: string; massaMagra: string; cintura: string } | null }) {
  const [estado, acao] = useActionState<EstadoCorpo, FormData>(salvarPesagem, {});
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="space-y-6" noValidate>
      <Campo nome="data" rotulo="Dia" tipo="date" valor={hoje} erro={e.data} />
      <Campo nome="pesoKg" rotulo="Peso" teclado="decimal" sufixo="kg" maxLength={6} valor={atual?.peso} erro={e.pesoKg} dica="Idealmente em jejum, de manhã." />
      <div className="grid grid-cols-2 gap-6">
        <Campo nome="massaMagraKg" rotulo="Massa magra (opcional)" teclado="decimal" sufixo="kg" maxLength={6} valor={atual?.massaMagra} erro={e.massaMagraKg} />
        <Campo nome="cinturaCm" rotulo="Cintura (opcional)" teclado="decimal" sufixo="cm" maxLength={6} valor={atual?.cintura} erro={e.cinturaCm} />
      </div>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <BotaoEnviar>Salvar pesagem</BotaoEnviar>
    </form>
  );
}
