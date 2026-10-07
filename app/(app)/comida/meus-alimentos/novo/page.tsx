import { exigirUsuario } from "@/lib/auth/sessao";
import { dataDiario, refeicao as refeicaoSchema } from "@/lib/validacao/comida";
import { Voltar } from "../../comum";
import { FormAlimento } from "../formulario";

export const metadata = { title: "Cadastrar alimento · FuelLift" };

export default async function PaginaNovoAlimento(props: PageProps<"/comida/meus-alimentos/novo">) {
  await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data;
  const refeicao = refeicaoSchema.safeParse(sp.refeicao).data;
  return (
    <div className="space-y-6">
      <Voltar href="/comida/meus-alimentos" />
      <h1 className="text-3xl font-black">Cadastrar pelo rótulo</h1>
      <FormAlimento data={data} refeicao={refeicao} />
    </div>
  );
}
