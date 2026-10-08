import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import {
  listarItensDoTreino,
  listarSeriesDoDia,
  listarTreinos,
  obterAgenda,
  obterSessao,
  obterTrocas,
  planoAtivo,
  ultimaSessaoDoExercicio,
} from "@/lib/dal/treino";
import { hojeSaoPaulo } from "@/lib/datas";
import { dicaDeProgressao, seriesDoExercicio, treinoDoDia } from "@/lib/treino";
import { dataAteHoje } from "@/lib/validacao/treino";
import { SessaoCliente, type DicaTela, type ItemTela } from "./sessao-cliente";

export const metadata = { title: "Treinando · Kalyft" };

export default async function PaginaSessao(props: PageProps<"/treino/sessao">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const data = dataAteHoje.safeParse(typeof pedido === "string" ? pedido : hoje).data;
  if (!data) notFound();

  const plano = await planoAtivo(userId);
  if (!plano) redirect("/treino");
  const [agenda, trocas, treinos, sessao, feitas] = await Promise.all([
    obterAgenda(userId),
    obterTrocas(userId, data, data),
    listarTreinos(userId, plano.id),
    obterSessao(userId, data),
    listarSeriesDoDia(userId, data),
  ]);
  const treino = treinos.find((t) => t.id === treinoDoDia(data, agenda, trocas)) ?? null;
  if (!treino) redirect(`/treino?data=${data}`);
  const itens = await listarItensDoTreino(userId, treino.id);

  // Dica de progressão: última sessão anterior de cada exercício (principal e substitutos).
  const dicas: Record<string, DicaTela | null> = {};
  await Promise.all(
    itens.flatMap((i) => {
      const nSeries = seriesDoExercicio(i.series, plano, data);
      return [i.exercicio, ...i.substitutos].map(async (ex) => {
        const ultima = await ultimaSessaoDoExercicio(userId, ex.id, data);
        const d = dicaDeProgressao(ultima, nSeries, i.repsMax, ex.medida === "segundos");
        dicas[`${i.id}:${ex.id}`] = d ? { ultima: d.ultima.map((s) => ({ numero: s.numero, cargaKg: s.cargaKg, repeticoes: s.repeticoes, segundos: s.segundos })), subirCarga: d.subirCarga } : null;
      });
    }),
  );

  const itensTela: ItemTela[] = itens.map((i) => ({
    id: i.id,
    series: seriesDoExercicio(i.series, plano, data),
    repsMin: i.repsMin,
    repsMax: i.repsMax,
    descansoS: i.descansoS,
    observacao: i.observacao,
    opcoes: [i.exercicio, ...i.substitutos].map((e, n) => ({
      id: e.id,
      nome: e.nome,
      principal: n === 0,
      unilateral: e.unilateral,
      cargaPorHalter: e.cargaPorHalter,
      porSegundos: e.medida === "segundos",
      fotoId: e.fotoId,
    })),
  }));

  return (
    <div className="space-y-6">
      <Link href={`/treino?data=${data}`} className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="text-3xl font-black">{treino.nome}</h1>
      {itensTela.length === 0 ? (
        <p className="text-suave">
          Este treino não tem exercícios. <Link href="/treino/plano" className="underline">Adicionar no plano</Link>
        </p>
      ) : (
        <SessaoCliente
          data={data}
          treinoId={treino.id}
          itens={itensTela}
          dicas={dicas}
          feitas={feitas.map((f) => ({ ...f, cargaKg: Number(f.cargaKg) }))}
          observacao={sessao?.observacao ?? ""}
        />
      )}
    </div>
  );
}
