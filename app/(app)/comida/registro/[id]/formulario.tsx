"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo, Opcoes } from "@/components/ui";
import { apagarRegistro, editarRegistro, type Estado } from "../../actions";

export function FormEditarRegistro({
  registroId,
  data,
  refeicao,
  gramas,
  opcoes,
}: {
  registroId: string;
  data: string;
  refeicao: string;
  gramas: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
}) {
  const [estado, acao] = useActionState<Estado, FormData>(editarRegistro, {});
  return (
    <div className="space-y-10">
      <form action={acao} className="space-y-8" noValidate>
        <input type="hidden" name="registroId" value={registroId} />
        <input type="hidden" name="data" value={data} />
        <Opcoes nome="refeicao" rotulo="Refeição" opcoes={opcoes} valor={refeicao} erro={estado.erros?.refeicao} />
        <Campo nome="gramas" rotulo="Quantidade" teclado="decimal" sufixo="g" maxLength={7} valor={gramas} erro={estado.erros?.gramas} dica="Os nutrientes são recalculados na mesma proporção." />
        {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
        <BotaoEnviar>Salvar</BotaoEnviar>
      </form>
      <form action={apagarRegistro} className="border-t border-linha pt-8">
        <input type="hidden" name="registroId" value={registroId} />
        <input type="hidden" name="data" value={data} />
        <button type="submit" className="min-h-12 w-full rounded-full border-2 border-erro font-semibold text-erro">
          Apagar registro
        </button>
      </form>
    </div>
  );
}
