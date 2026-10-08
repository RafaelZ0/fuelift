import { exigirUsuario } from "@/lib/auth/sessao";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { comArtigo, dataDiario, refeicao as refeicaoSchema, REFEICOES, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { Voltar } from "../comum";
import { FormCopiar } from "./formulario";

export const metadata = { title: "Copiar refeição · Kalyft" };

export default async function PaginaCopiar(props: PageProps<"/comida/copiar">) {
  await exigirUsuario();
  const sp = await props.searchParams;
  const hoje = hojeSaoPaulo();
  const data = dataDiario.safeParse(sp.data).data ?? hoje;
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";
  return (
    <div className="space-y-6">
      <Voltar href={`/comida?data=${data}`} />
      <h1 className="text-3xl font-black">Copiar {comArtigo(ref, "para")}</h1>
      <p className="text-suave">Os alimentos e as quantidades são copiados, e os nutrientes são recalculados como registros novos deste dia.</p>
      <FormCopiar
        paraData={data}
        paraRefeicao={ref}
        deData={somarDias(data, -1)}
        maxData={hoje}
        opcoes={REFEICOES.map((r) => ({ valor: r, rotulo: ROTULOS_REFEICAO[r] }))}
      />
    </div>
  );
}
