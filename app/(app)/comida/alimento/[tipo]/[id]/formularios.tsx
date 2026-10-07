"use client";

import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { calcularNutrientes, formatarGramas, formatarKcal, gramasDaMedida, type Por100g } from "@/lib/nutricao";
import { adicionar, apagarMedida, salvarMedida, type Estado } from "../../../actions";

type MedidaTela = { id: string; nome: string; gramas: number };

const numero = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function FormAdicionar({
  alimento,
  medidas,
  data,
  refeicao,
  rotuloRefeicao,
}: {
  alimento: Por100g & { tipo: string; id: string };
  medidas: MedidaTela[];
  data: string;
  refeicao: string;
  rotuloRefeicao: string;
}) {
  const [estado, acao] = useActionState<Estado, FormData>(adicionar, {});
  const [modo, setModo] = useState<"gramas" | "medida">(medidas.length > 0 ? "medida" : "gramas");
  const [gramasTxt, setGramasTxt] = useState("100");
  const [qtdTxt, setQtdTxt] = useState("1");
  const [medidaId, setMedidaId] = useState(medidas[0]?.id ?? "");

  // Sem escolha válida (ex.: medida recém-criada), usa a primeira da lista.
  const medida = medidas.find((x) => x.id === medidaId) ?? medidas[0];
  // Prévia no navegador; o servidor recalcula ao salvar.
  const gramas = modo === "gramas" ? numero(gramasTxt) : medida ? gramasDaMedida(medida.gramas, numero(qtdTxt)) : 0;
  const previa = gramas > 0 ? calcularNutrientes(alimento, gramas) : null;

  return (
    <form action={acao} className="space-y-6 rounded-2xl border-2 border-linha p-4" noValidate>
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="refeicao" value={refeicao} />
      <input type="hidden" name="tipo" value={alimento.tipo} />
      <input type="hidden" name="alimentoId" value={alimento.id} />
      <input type="hidden" name="modo" value={modo} />

      {medidas.length > 0 ? (
        <div className="flex gap-2" role="group" aria-label="Como informar a quantidade">
          {(["medida", "gramas"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`min-h-12 flex-1 rounded-full border-2 font-semibold ${modo === m ? "border-destaque text-texto" : "border-linha text-suave"}`}
            >
              {m === "medida" ? "Medida" : "Gramas"}
            </button>
          ))}
        </div>
      ) : null}

      {modo === "gramas" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Quantidade</span>
          <span className="flex items-center gap-3 border-b-2 border-linha focus-within:border-destaque">
            <input
              name="gramas"
              inputMode="decimal"
              value={gramasTxt}
              onChange={(e) => setGramasTxt(e.target.value)}
              maxLength={7}
              aria-invalid={estado.erros?.gramas ? true : undefined}
              className="min-h-12 w-full bg-transparent py-2 text-2xl font-bold outline-none"
            />
            <span className="text-suave">g</span>
          </span>
          {estado.erros?.gramas ? <span className="mt-1 block text-sm text-erro">{estado.erros.gramas}</span> : null}
        </label>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-suave">Medida</legend>
            <div className="flex flex-wrap gap-2">
              {medidas.map((x) => (
                <label key={x.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="medidaId"
                    value={x.id}
                    checked={medida?.id === x.id}
                    onChange={() => setMedidaId(x.id)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-12 items-center rounded-full border-2 border-linha px-4 font-semibold text-suave peer-checked:border-destaque peer-checked:text-texto">
                    {x.nome} · {formatarGramas(x.gramas)} g
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-suave">Quantas</span>
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => setQtdTxt(String(Math.max(0.5, numero(qtdTxt) - 0.5)))} aria-label="Menos meia" className="min-h-12 min-w-12 rounded-full border-2 border-linha text-xl font-bold">
                −
              </button>
              <input
                name="quantidade"
                inputMode="decimal"
                value={qtdTxt}
                onChange={(e) => setQtdTxt(e.target.value)}
                maxLength={5}
                className="min-h-12 w-20 border-b-2 border-linha bg-transparent text-center text-2xl font-bold outline-none focus:border-destaque"
              />
              <button type="button" onClick={() => setQtdTxt(String(numero(qtdTxt) + 0.5))} aria-label="Mais meia" className="min-h-12 min-w-12 rounded-full border-2 border-linha text-xl font-bold">
                +
              </button>
            </span>
          </label>
        </div>
      )}

      <div className="rounded-xl bg-superficie p-3">
        {previa ? (
          <p className="text-lg">
            <span className="font-bold">{formatarKcal(previa.kcal)} kcal</span>
            <span className="text-suave">
              {" "}
              · {formatarGramas(gramas)} g · P {formatarGramas(previa.proteinaG)} · C {formatarGramas(previa.carboG)} · G {formatarGramas(previa.gorduraG)}
            </span>
          </p>
        ) : (
          <p className="text-suave">Informe a quantidade.</p>
        )}
      </div>

      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="Adicionando…">Adicionar {rotuloRefeicao}</BotaoEnviar>
    </form>
  );
}

export function Medidas({ tipo, alimentoId, medidas }: { tipo: string; alimentoId: string; medidas: MedidaTela[] }) {
  const [estado, acao] = useActionState<Estado, FormData>(salvarMedida, {});
  return (
    <section aria-labelledby="medidas" className="space-y-3">
      <h2 id="medidas" className="text-xl font-bold">Minhas medidas</h2>
      {medidas.length === 0 ? <p className="text-suave">Ex.: &quot;minha concha&quot; = 140 g.</p> : null}
      <ul>
        {medidas.map((x) => (
          <li key={x.id} className="flex min-h-12 items-center justify-between border-b border-linha">
            <span>
              {x.nome} · <span className="text-suave">{formatarGramas(x.gramas)} g</span>
            </span>
            <form action={apagarMedida}>
              <input type="hidden" name="medidaId" value={x.id} />
              <button type="submit" className="min-h-11 px-3 text-sm font-semibold text-suave underline">
                Apagar
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={acao} className="space-y-4" noValidate>
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="alimentoId" value={alimentoId} />
        <div className="grid grid-cols-[1fr_7rem] gap-4">
          <Campo nome="nome" rotulo="Nome da medida" maxLength={40} erro={estado.erros?.nome} />
          <Campo nome="gramas" rotulo="Gramas" teclado="decimal" sufixo="g" maxLength={7} erro={estado.erros?.gramas} />
        </div>
        {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
        <BotaoEnviar>Salvar medida</BotaoEnviar>
      </form>
    </section>
  );
}
