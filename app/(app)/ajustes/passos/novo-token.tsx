"use client";

import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar, BotaoSecundario, Campo } from "@/components/ui";
import { criarTokenPassos, type EstadoToken } from "./actions";

export function NovoToken() {
  const [estado, acao] = useActionState<EstadoToken, FormData>(criarTokenPassos, {});
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(estado.token ?? "");
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="space-y-5">
      <form action={acao} className="space-y-5" noValidate>
        <Campo nome="nome" rotulo="Nome da chave" maxLength={40} valor="iPhone" dica="Só para você reconhecer depois." />
        {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
        <BotaoEnviar pendente="Criando…">Criar chave</BotaoEnviar>
      </form>
      {estado.token ? (
        <div className="space-y-3 rounded-2xl border-2 border-marca p-4" aria-live="polite">
          <p className="font-bold">Chave &quot;{estado.nome}&quot; criada. Copie agora: ela não aparece de novo.</p>
          <p className="break-all rounded-xl bg-superficie p-3 font-mono text-sm">{estado.token}</p>
          <BotaoSecundario onClick={copiar}>{copiado ? "Copiada ✓" : "Copiar a chave"}</BotaoSecundario>
          <p className="text-sm text-suave">Trate como uma senha: quem tiver essa chave consegue enviar passos para a sua conta. Se vazar, revogue abaixo.</p>
        </div>
      ) : null}
    </div>
  );
}
