import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarTreinos, obterAgenda, obterTrocas, planoAtivo } from "@/lib/dal/treino";
import { hojeSaoPaulo, rotuloDia } from "@/lib/datas";
import { treinoDoDia } from "@/lib/treino";
import { dataAteHoje } from "@/lib/validacao/treino";
import { FormFalta } from "./form-falta";

export const metadata = { title: "Falta · Kalyft" };

export default async function PaginaFalta(props: PageProps<"/treino/falta">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const data = dataAteHoje.safeParse(typeof pedido === "string" ? pedido : hoje).data;
  if (!data) notFound();
  const plano = await planoAtivo(userId);
  if (!plano) redirect("/treino");
  const [agenda, trocas, treinos] = await Promise.all([obterAgenda(userId), obterTrocas(userId, data, data), listarTreinos(userId, plano.id)]);
  const treino = treinos.find((t) => t.id === treinoDoDia(data, agenda, trocas)) ?? null;

  return (
    <div className="space-y-6">
      <Link href={`/treino?data=${data}`} className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="text-3xl font-black">Não vou treinar</h1>
      <p className="text-suave">
        {rotuloDia(data, hoje)}
        {treino ? ` · ${treino.nome}` : ""}
      </p>
      <FormFalta data={data} treinoId={treino?.id ?? ""} />
    </div>
  );
}
