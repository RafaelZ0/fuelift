import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import { citacaoTaco, obterAlimento } from "@/lib/dal/alimentos";
import { ehFavorito, listarMedidas } from "@/lib/dal/medidas";
import { hojeSaoPaulo } from "@/lib/datas";
import type { Marcacoes } from "@/lib/db/schema";
import { formatarGramas, formatarKcal } from "@/lib/nutricao";
import { dataDiario, id as idSchema, refeicao as refeicaoSchema, ROTULOS_REFEICAO, tipoAlimento } from "@/lib/validacao/comida";
import { favoritar } from "../../../actions";
import { CitacaoTaco, Voltar, voltaQuery } from "../../../comum";
import { FormAdicionar, Medidas } from "./formularios";

export const metadata = { title: "Alimento · FuelLift" };

const ROTULO_MARCA: Record<string, string> = {
  Tr: "traço",
  NA: "não se aplica",
  "*": "em reavaliação na TACO",
  vazio: "não analisado",
  negativo: "≈ 0 (cálculo por diferença)",
};

function Valor({ v, marca, unidade, kcal = false }: { v: number | null; marca?: Marcacoes[keyof Marcacoes]; unidade: string; kcal?: boolean }) {
  const texto = v === null ? "—" : `${kcal ? formatarKcal(v) : formatarGramas(v)} ${unidade}`;
  const nota = marca?.fonte === "usda" ? `fonte: USDA (${marca.ref})` : marca?.marca ? ROTULO_MARCA[marca.marca] : null;
  return (
    <dd className="text-right">
      <span className="text-lg font-semibold">{texto}</span>
      {nota ? <span className="block text-xs text-suave">{nota}</span> : null}
    </dd>
  );
}

export default async function PaginaAlimento(props: PageProps<"/comida/alimento/[tipo]/[id]">) {
  const { userId } = await exigirUsuario();
  const { tipo: tipoBruto, id: idBruto } = await props.params;
  const tipo = tipoAlimento.safeParse(tipoBruto);
  const id = idSchema.safeParse(idBruto);
  if (!tipo.success || !id.success) notFound();

  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";

  const alimento = await obterAlimento(userId, tipo.data, id.data);
  if (!alimento) notFound();
  const [medidas, favorito, citacao] = await Promise.all([
    listarMedidas(userId, tipo.data, id.data),
    ehFavorito(userId, tipo.data, id.data),
    tipo.data === "base" ? citacaoTaco() : Promise.resolve(null),
  ]);
  const m = alimento.marcacoes;

  return (
    <div className="space-y-8">
      <Voltar href={`/comida/adicionar${voltaQuery(data, ref)}`} />
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-black leading-tight">{alimento.nome}</h1>
          <form action={favoritar}>
            <input type="hidden" name="tipo" value={alimento.tipo} />
            <input type="hidden" name="alimentoId" value={alimento.id} />
            <button
              type="submit"
              aria-pressed={favorito}
              aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              className={`flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 text-2xl ${favorito ? "border-destaque text-destaque" : "border-linha text-suave"}`}
            >
              ★
            </button>
          </form>
        </div>
        <p className="text-suave">
          {alimento.tipo === "base" ? `TACO · ${alimento.grupo ?? ""}` : `Meu alimento${alimento.marca ? ` · ${alimento.marca}` : ""}`}
          {alimento.tipo === "usuario" ? (
            <>
              {" · "}
              <Link href={`/comida/meus-alimentos/${alimento.id}`} className="underline">
                Editar
              </Link>
            </>
          ) : null}
        </p>
      </header>

      {alimento.kcal === null ? (
        <p role="alert" className="rounded-2xl border-2 border-erro p-4 font-medium text-erro">
          As calorias deste alimento estão em reavaliação na TACO, então ele não pode ser adicionado. Cadastre pelo rótulo do produto.
        </p>
      ) : (
        <FormAdicionar
          alimento={{
            tipo: alimento.tipo,
            id: alimento.id,
            kcal: alimento.kcal,
            proteinaG: alimento.proteinaG,
            carboG: alimento.carboG,
            gorduraG: alimento.gorduraG,
            fibraG: alimento.fibraG,
          }}
          medidas={medidas.map((x) => ({ id: x.id, nome: x.nome, gramas: x.gramas }))}
          data={data}
          refeicao={ref}
          rotuloRefeicao={ROTULOS_REFEICAO[ref]}
        />
      )}

      <section aria-labelledby="por100" className="space-y-2">
        <h2 id="por100" className="text-xl font-bold">Por 100 g</h2>
        <dl className="divide-y divide-linha">
          {[
            ["Calorias", <Valor key="k" v={alimento.kcal} marca={m.kcal} unidade="kcal" kcal />],
            ["Proteína", <Valor key="p" v={alimento.proteinaG} marca={m.proteina_g} unidade="g" />],
            ["Carboidrato (inclui fibra)", <Valor key="c" v={alimento.carboG} marca={m.carbo_g} unidade="g" />],
            ["Gordura", <Valor key="g" v={alimento.gorduraG} marca={m.gordura_g} unidade="g" />],
            ["Fibra", <Valor key="f" v={alimento.fibraG} marca={m.fibra_g} unidade="g" />],
            ["Sódio", <Valor key="s" v={alimento.sodioMg} marca={m.sodio_mg} unidade="mg" kcal />],
          ].map(([rotulo, valor]) => (
            <div key={rotulo as string} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-suave">{rotulo}</dt>
              {valor}
            </div>
          ))}
        </dl>
      </section>

      <Medidas tipo={alimento.tipo} alimentoId={alimento.id} medidas={medidas.map((x) => ({ id: x.id, nome: x.nome, gramas: x.gramas }))} />

      <CitacaoTaco citacao={citacao} />
    </div>
  );
}
