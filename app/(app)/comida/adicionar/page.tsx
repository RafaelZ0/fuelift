import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { citacaoTaco, listarFavoritos, listarRecentes } from "@/lib/dal/alimentos";
import { hojeSaoPaulo } from "@/lib/datas";
import { dataDiario, refeicao as refeicaoSchema, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { CitacaoTaco, ListaAlimentos, Voltar, voltaQuery } from "../comum";
import { Busca } from "./busca";

export const metadata = { title: "Adicionar alimento · Kalyft" };

export default async function PaginaAdicionar(props: PageProps<"/comida/adicionar">) {
  const { userId } = await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";
  const volta = voltaQuery(data, ref);

  const [recentes, favs, citacao] = await Promise.all([
    listarRecentes(userId),
    listarFavoritos(userId),
    citacaoTaco(),
  ]);

  return (
    <div className="space-y-6">
      <Voltar href={`/comida?data=${data}`} />
      <h1 className="text-3xl font-black">{ROTULOS_REFEICAO[ref]}</h1>
      <Busca volta={volta}>
        {favs.length > 0 ? (
          <section className="space-y-1">
            <h2 className="text-lg font-bold">Favoritos</h2>
            <ListaAlimentos itens={favs} volta={volta} />
          </section>
        ) : null}
        {recentes.length > 0 ? (
          <section className="space-y-1">
            <h2 className="text-lg font-bold">Recentes</h2>
            <ListaAlimentos itens={recentes} volta={volta} />
          </section>
        ) : null}
        {favs.length === 0 && recentes.length === 0 ? (
          <p className="text-suave">Digite o nome do alimento. Ex.: arroz, feijão, frango.</p>
        ) : null}
      </Busca>
      <Link
        href={`/comida/barras${volta}`}
        className="flex min-h-12 items-center justify-center rounded-full bg-destaque font-bold text-sobre-destaque"
      >
        Ler código de barras
      </Link>
      <Link
        href={`/comida/meus-alimentos/novo${volta}`}
        className="flex min-h-12 items-center justify-center rounded-full border-2 border-borda font-semibold"
      >
        Não achou? Cadastrar pelo rótulo
      </Link>
      <CitacaoTaco citacao={citacao} />
    </div>
  );
}
