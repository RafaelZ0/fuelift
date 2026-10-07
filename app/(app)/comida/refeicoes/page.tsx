import { exigirUsuario } from "@/lib/auth/sessao";
import { listarRefeicoesSalvas } from "@/lib/dal/refeicoes-salvas";
import { hojeSaoPaulo } from "@/lib/datas";
import { dataDiario, refeicao as refeicaoSchema, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { apagarRefeicaoSalva } from "../actions";
import { Voltar } from "../comum";
import { UsarRefeicao } from "./usar";

export const metadata = { title: "Refeições salvas · FuelLift" };

export default async function PaginaRefeicoes(props: PageProps<"/comida/refeicoes">) {
  const { userId } = await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? null;
  const salvas = await listarRefeicoesSalvas(userId);

  return (
    <div className="space-y-6">
      <Voltar href={`/comida?data=${data}`} />
      <h1 className="text-3xl font-black">Refeições salvas</h1>
      <p className="text-suave">
        Para salvar uma refeição, abra o dia em Comida e toque em &quot;Mais&quot; na refeição. Ao usar, os nutrientes são recalculados.
      </p>
      {salvas.length === 0 ? <p className="text-suave">Nenhuma refeição salva ainda.</p> : null}
      <ul className="space-y-4">
        {salvas.map((s) => (
          <li key={s.id} className="space-y-3 rounded-2xl border-2 border-linha p-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg font-bold">{s.nome}</span>
              <span className="text-sm text-suave">{s.itens} itens</span>
            </div>
            {ref ? (
              <UsarRefeicao refeicaoSalvaId={s.id} data={data} refeicao={ref} rotulo={`Usar no ${ROTULOS_REFEICAO[ref].toLowerCase()}`} />
            ) : null}
            <form action={apagarRefeicaoSalva}>
              <input type="hidden" name="refeicaoSalvaId" value={s.id} />
              <button type="submit" className="min-h-11 text-sm font-semibold text-suave underline">
                Apagar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
