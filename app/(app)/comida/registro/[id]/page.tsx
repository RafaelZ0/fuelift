import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import { obterRegistro } from "@/lib/dal/registros";
import { formatarGramas, formatarKcal } from "@/lib/nutricao";
import { id as idSchema, REFEICOES, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { Voltar } from "../../comum";
import { FormEditarRegistro } from "./formulario";

export const metadata = { title: "Editar registro · FuelLift" };

export default async function PaginaRegistro(props: PageProps<"/comida/registro/[id]">) {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse((await props.params).id);
  if (!id.success) notFound();
  const registro = await obterRegistro(userId, id.data);
  if (!registro) notFound();

  return (
    <div className="space-y-8">
      <Voltar href={`/comida?data=${registro.data}`} />
      <header className="space-y-1">
        <h1 className="text-3xl font-black leading-tight">{registro.nome}</h1>
        <p className="text-suave">
          {formatarKcal(registro.kcal)} kcal · {formatarGramas(registro.gramas)} g
          {registro.medidaTexto ? ` · ${registro.medidaTexto}` : ""}
        </p>
      </header>
      <FormEditarRegistro
        registroId={registro.id}
        data={registro.data}
        refeicao={registro.refeicao}
        gramas={String(registro.gramas).replace(".", ",")}
        opcoes={REFEICOES.map((r) => ({ valor: r, rotulo: ROTULOS_REFEICAO[r] }))}
      />
    </div>
  );
}
