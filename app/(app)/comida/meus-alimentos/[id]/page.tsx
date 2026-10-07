import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import { obterAlimento } from "@/lib/dal/alimentos";
import { id as idSchema } from "@/lib/validacao/comida";
import { apagarAlimento } from "../../actions";
import { Voltar } from "../../comum";
import { FormAlimento } from "../formulario";

export const metadata = { title: "Editar alimento · FuelLift" };

const txt = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

export default async function PaginaEditarAlimento(props: PageProps<"/comida/meus-alimentos/[id]">) {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse((await props.params).id);
  if (!id.success) notFound();
  const a = await obterAlimento(userId, "usuario", id.data);
  if (!a) notFound();

  return (
    <div className="space-y-6">
      <Voltar href="/comida/meus-alimentos" />
      <h1 className="text-3xl font-black">Editar alimento</h1>
      <p className="text-sm text-suave">Os valores estão por 100 g. Registros antigos não mudam.</p>
      <Link href={`/comida/alimento/usuario/${a.id}`} className="inline-flex min-h-11 items-center font-semibold underline">
        Adicionar ao diário
      </Link>
      <FormAlimento
        alimentoId={a.id}
        valores={{
          nome: a.nome,
          marca: a.marca ?? "",
          porcaoG: "100",
          kcal: txt(a.kcal),
          proteinaG: txt(a.proteinaG),
          carboG: txt(a.carboG),
          gorduraG: txt(a.gorduraG),
          fibraG: txt(a.fibraG),
          sodioMg: txt(a.sodioMg),
        }}
      />
      <form action={apagarAlimento} className="border-t border-linha pt-8">
        <input type="hidden" name="alimentoId" value={a.id} />
        <button type="submit" className="min-h-12 w-full rounded-full border-2 border-erro font-semibold text-erro">
          Apagar alimento
        </button>
      </form>
    </div>
  );
}
