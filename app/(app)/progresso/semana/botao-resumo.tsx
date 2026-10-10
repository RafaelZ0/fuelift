"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso, BotaoEnviar } from "@/components/ui";
import { gerarResumoSemana, type EstadoResumo } from "./actions";

export function BotaoResumo({ inicio, temTexto }: { inicio: string; temTexto: boolean }) {
  const [estado, acao] = useActionState<EstadoResumo, FormData>(gerarResumoSemana, {});
  return (
    <form action={acao} className="space-y-3" noValidate>
      <input type="hidden" name="inicio" value={inicio} />
      <p className="text-xs text-suave">A IA recebe só os números desta semana (sem nome, e-mail ou identificador) e escreve um parágrafo. Se citar um número que não é seu, o texto é descartado.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.precisaAceite ? <Link href="/treino/ia" className="block font-semibold underline">Ler e aceitar o aviso da IA</Link> : null}
      <BotaoEnviar pendente="A IA está escrevendo…">{temTexto ? "Gerar o resumo de novo" : "Gerar resumo com a IA"}</BotaoEnviar>
    </form>
  );
}
