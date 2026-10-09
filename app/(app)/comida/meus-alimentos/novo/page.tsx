import { exigirUsuario } from "@/lib/auth/sessao";
import { normalizarCodigo } from "@/lib/barras";
import { obterProdutoEmCache } from "@/lib/dal/produtos";
import { dataDiario, refeicao as refeicaoSchema } from "@/lib/validacao/comida";
import { Voltar } from "../../comum";
import { FormAlimento, type ValoresAlimento } from "../formulario";

const MOTIVOS: Record<string, string> = {
  conferir: "Os dados deste produto no Open Food Facts estão incompletos ou não fecham. Confira cada número com a embalagem antes de salvar.",
  sem_calorias: "O Open Food Facts conhece este produto, mas sem calorias. Cadastre pelo rótulo da embalagem.",
  nao_encontrado: "Este produto não está no Open Food Facts. Cadastre pelo rótulo da embalagem.",
};
const texto = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export const metadata = { title: "Cadastrar alimento · Kalyft" };

export default async function PaginaNovoAlimento(props: PageProps<"/comida/meus-alimentos/novo">) {
  await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data;
  const refeicao = refeicaoSchema.safeParse(sp.refeicao).data;
  const codigo = typeof sp.codigo === "string" ? normalizarCodigo(sp.codigo) : null;
  const motivo = typeof sp.motivo === "string" ? MOTIVOS[sp.motivo] : undefined;

  // Valores sugeridos pelo cache do Open Food Facts (por 100 g). O usuário confere tudo antes de salvar.
  let valores: ValoresAlimento | undefined;
  if (codigo) {
    const p = await obterProdutoEmCache(codigo);
    if (p?.status === "encontrado") {
      valores = {
        nome: p.nome ?? "",
        marca: p.marca ?? "",
        porcaoG: "100",
        kcal: texto(p.kcal),
        proteinaG: texto(p.proteinaG),
        carboG: texto(p.carboG),
        gorduraG: texto(p.gorduraG),
        fibraG: texto(p.fibraG),
        sodioMg: texto(p.sodioMg),
      };
    }
  }
  return (
    <div className="space-y-6">
      <Voltar href="/comida/meus-alimentos" />
      <h1 className="text-3xl font-black">Cadastrar pelo rótulo</h1>
      {motivo ? (
        <p role="status" className="rounded-2xl border-2 border-aviso p-4 font-medium text-aviso">
          <span aria-hidden="true">! </span>
          {motivo}
        </p>
      ) : null}
      {codigo ? <p className="text-suave">Código de barras: {codigo}</p> : null}
      <FormAlimento data={data} refeicao={refeicao} valores={valores} codigo={codigo ?? undefined} />
      {valores ? (
        <p className="text-sm text-suave">
          Valores sugeridos por <a href="https://world.openfoodfacts.org" className="underline" target="_blank" rel="noopener noreferrer">Open Food Facts</a> (ODbL), por 100 g.
        </p>
      ) : null}
    </div>
  );
}
