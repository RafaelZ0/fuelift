import { exigirUsuario } from "@/lib/auth/sessao";
import { hojeSaoPaulo } from "@/lib/datas";
import { dataDiario, refeicao as refeicaoSchema } from "@/lib/validacao/comida";
import { Voltar, voltaQuery } from "../comum";
import { Leitor } from "./leitor";

export const metadata = { title: "Código de barras · Kalyft" };

export default async function PaginaBarras(props: PageProps<"/comida/barras">) {
  await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";
  return (
    <div className="space-y-6">
      <Voltar href={`/comida/adicionar${voltaQuery(data, ref)}`} />
      <h1 className="text-3xl font-black">Código de barras</h1>
      <Leitor data={data} refeicao={ref} />
    </div>
  );
}
