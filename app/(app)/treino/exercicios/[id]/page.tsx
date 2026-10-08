import Link from "next/link";
import { notFound } from "next/navigation";
import { FotoExercicio } from "@/components/foto-exercicio";
import { GraficoLinhas } from "@/components/graficos";
import { exigirUsuario } from "@/lib/auth/sessao";
import { evolucaoDoExercicio, obterExercicio } from "@/lib/dal/treino";
import { diasEntre } from "@/lib/treino";
import { formatarDataBr } from "@/lib/datas";
import { id as idSchema } from "@/lib/validacao/treino";
import { apagarExercicio } from "../../actions";
import { FormExercicio } from "../form-exercicio";

export const metadata = { title: "Exercício · FuelLift" };

export default async function PaginaExercicio(props: PageProps<"/treino/exercicios/[id]">) {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse((await props.params).id);
  if (!id.success) notFound();
  const ex = await obterExercicio(userId, id.data);
  if (!ex) notFound();
  const evolucao = await evolucaoDoExercicio(userId, ex.id);
  const primeira = evolucao[0]?.data;

  return (
    <div className="space-y-10">
      <Link href="/treino/exercicios" className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="text-3xl font-black leading-tight">{ex.nome}</h1>
      <FotoExercicio fotoId={ex.fotoId} nome={ex.nome} />

      <section aria-labelledby="evolucao" className="space-y-4">
        <h2 id="evolucao" className="text-2xl font-bold">Evolução</h2>
        {evolucao.length >= 2 ? (
          <GraficoLinhas
            titulo={`Maior carga por sessão de ${ex.nome}`}
            unidade="kg"
            rotulosX={[formatarDataBr(evolucao[0].data), formatarDataBr(evolucao.at(-1)!.data)]}
            series={[{ nome: "Maior carga", tipo: "linha", pontos: evolucao.map((e) => ({ x: diasEntre(primeira!, e.data), y: e.cargaMax })) }]}
          />
        ) : (
          <p className="text-suave">O gráfico aparece a partir da segunda sessão com este exercício.</p>
        )}
        {evolucao.length > 0 ? (
          <ul>
            {[...evolucao].reverse().slice(0, 20).map((e) => (
              <li key={e.data} className="flex min-h-11 items-center justify-between border-b border-linha text-sm">
                <span>{formatarDataBr(e.data)}</span>
                <span className="font-semibold">
                  {e.cargaMax.toLocaleString("pt-BR")} kg <span className="font-normal text-suave">· {e.series} séries</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="editar" className="space-y-4 border-t border-linha pt-8">
        <h2 id="editar" className="text-2xl font-bold">Editar</h2>
        <FormExercicio
          valores={{ id: ex.id, nome: ex.nome, grupo: ex.grupo ?? "", unilateral: ex.unilateral, cargaPorHalter: ex.cargaPorHalter, medida: ex.medida, fotoId: ex.fotoId ?? "" }}
        />
        <form action={apagarExercicio} className="pt-4">
          <input type="hidden" name="exercicioId" value={ex.id} />
          <button type="submit" className="min-h-12 w-full rounded-full border-2 border-erro font-semibold text-erro">
            Apagar exercício (apaga também as séries registradas)
          </button>
        </form>
      </section>
    </div>
  );
}
