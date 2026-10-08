"use client";

import { useActionState } from "react";
import { Aviso, BotaoEnviar } from "@/components/ui";
import { aceitarUsoIa, type EstadoIa } from "./actions";

export function FormAceite({ gratuito }: { gratuito: boolean }) {
  const [estado, acao] = useActionState<EstadoIa, FormData>(aceitarUsoIa, {});
  return (
    <form action={acao} className="space-y-6" noValidate>
      <ul className="list-disc space-y-3 pl-5 text-lg">
        <li>
          A IA monta um <strong>rascunho</strong>. Nada é salvo sem você conferir e confirmar.
        </li>
        <li>
          O que você pedir (e as imagens ou PDF que enviar) é enviado ao <strong>Google (Gemini)</strong>. Antes de enviar, o app mostra exatamente o que vai.
        </li>
        <li>Nunca são enviados seu nome, e-mail ou identificador da conta. Dados do corpo (sexo, idade, altura, peso) só vão se você marcar.</li>
        {gratuito ? (
          <li>
            Neste app o Gemini é usado no plano <strong>gratuito</strong>: o Google pode usar o conteúdo para melhorar seus produtos e pessoas podem revisá-lo. Por isso, <strong>não envie documentos com dados pessoais</strong> (nome, CPF, exames).
          </li>
        ) : null}
        <li>A IA não é médica nem nutricionista. Se tiver dor, lesão ou doença, converse com um profissional antes de treinar.</li>
        <li>Há um limite de gerações por dia.</li>
      </ul>
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" name="regiao" className="mt-1 size-6 shrink-0 accent-[var(--color-destaque)]" />
        <span className="text-lg">Tenho 18 anos ou mais e não estou na União Europeia, no Reino Unido nem na Suíça.</span>
      </label>
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" name="dados" className="mt-1 size-6 shrink-0 accent-[var(--color-destaque)]" />
        <span className="text-lg">Entendi que o conteúdo enviado vai para o Google e que o resultado é só um rascunho.</span>
      </label>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar>Aceitar e continuar</BotaoEnviar>
    </form>
  );
}
