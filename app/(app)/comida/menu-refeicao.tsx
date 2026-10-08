"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { salvarComoRefeicao, type Estado } from "./actions";

export function MenuRefeicao({ data, refeicao, temItens }: { data: string; refeicao: string; temItens: boolean }) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarComoRefeicao, {});
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center rounded-full border-2 border-borda px-4 font-semibold text-suave">
        Mais
      </summary>
      <div className="mt-3 space-y-3 rounded-2xl border-2 border-borda p-4">
        <Link href={`/comida/copiar?data=${data}&refeicao=${refeicao}`} className="flex min-h-12 items-center font-semibold underline">
          Copiar de outro dia
        </Link>
        <Link href={`/comida/refeicoes?data=${data}&refeicao=${refeicao}`} className="flex min-h-12 items-center font-semibold underline">
          Usar refeição salva
        </Link>
        {temItens ? (
          <form action={acao} className="space-y-4 border-t border-linha pt-4" noValidate>
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="refeicao" value={refeicao} />
            <Campo nome="nome" rotulo="Salvar esta refeição como" maxLength={80} erro={estado.erros?.nome} />
            {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
            {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
            <BotaoEnviar>Salvar refeição</BotaoEnviar>
          </form>
        ) : null}
      </div>
    </details>
  );
}
