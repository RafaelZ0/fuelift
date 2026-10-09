"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar } from "@/components/ui";
import { FATORES_ATIVIDADE, ROTULOS_ATIVIDADE } from "@/lib/energia";
import { LIMITES_ATIVIDADE, montarEntradaAtividade } from "@/lib/ia/atividade";
import { AVISO_NAO_ENVIADO } from "@/lib/ia/prompts";
import { confirmarAtividade, diagnosticarAtividade, type EstadoAtividade } from "./actions";

export function Diagnostico({ treinosPorSemana, iaDisponivel }: { treinosPorSemana: number | null; iaDisponivel: boolean }) {
  const [texto, setTexto] = useState("");
  const [estado, acao] = useActionState<EstadoAtividade, FormData>(diagnosticarAtividade, {});
  const entrada = montarEntradaAtividade(texto, treinosPorSemana);
  if (!iaDisponivel) return <p className="text-suave">A IA não está ativada aqui. Escolha o seu nível na lista abaixo.</p>;
  return (
    <div className="space-y-6">
      <form action={acao} className="space-y-5" noValidate>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Como é a sua semana? (trabalho, deslocamento, exercícios)</span>
          <textarea
            name="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={LIMITES_ATIVIDADE.textoMax}
            rows={4}
            placeholder="Ex.: Trabalho sentado em escritório, musculação 4x por semana e caminho 30 minutos no almoço"
            className="w-full rounded-2xl border-2 border-borda bg-superficie p-4 text-lg outline-none placeholder:text-suave focus:border-marca"
          />
        </label>
        <section aria-labelledby="previa-ativ" className="space-y-1 rounded-2xl border-2 border-borda p-4">
          <h2 id="previa-ativ" className="text-lg font-bold">O que será enviado ao Google</h2>
          {entrada ? (
            <dl className="space-y-1">
              {entrada.linhas.map((l) => (
                <div key={l.rotulo}>
                  <dt className="text-sm text-suave">{l.rotulo}</dt>
                  <dd className="font-semibold">{l.valor}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-suave">Escreva sobre a sua semana para ver o que será enviado.</p>
          )}
          <p className="text-sm text-suave">{AVISO_NAO_ENVIADO}</p>
        </section>
        {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
        {estado.precisaAceite ? <Link href="/treino/ia" className="block font-semibold underline">Ler e aceitar o aviso da IA</Link> : null}
        <BotaoEnviar pendente="A IA está avaliando…">Descobrir meu nível</BotaoEnviar>
      </form>

      {estado.resultado ? (
        <div className="space-y-3 rounded-2xl border-2 border-marca p-4" aria-live="polite">
          <p className="text-sm font-semibold text-suave">Sugestão da IA (estimativa)</p>
          <p className="text-xl font-bold">{ROTULOS_ATIVIDADE[estado.resultado.nivel]}</p>
          <p>{estado.resultado.justificativa}</p>
          <p className="text-sm text-suave">Fator de atividade usado no cálculo: {String(FATORES_ATIVIDADE[estado.resultado.nivel]).replace(".", ",")}.</p>
          <form action={confirmarAtividade}>
            <input type="hidden" name="nivel" value={estado.resultado.nivel} />
            <button type="submit" className="min-h-12 w-full rounded-full bg-destaque font-bold text-sobre-destaque">Usar este nível</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
