import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { obterPerfil } from "@/lib/dal/perfil";
import { obterAgenda } from "@/lib/dal/treino";
import { FATORES_ATIVIDADE, NIVEIS_ATIVIDADE, ROTULOS_ATIVIDADE } from "@/lib/energia";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { confirmarAtividade } from "./actions";
import { Diagnostico } from "./diagnostico";

export const metadata = { title: "Nível de atividade · Kalyft" };

export default async function PaginaAtividade(props: PageProps<"/ajustes/atividade">) {
  const { userId, admin } = await exigirUsuario();
  const sp = await props.searchParams;
  const [perfil, agenda, acesso] = await Promise.all([obterPerfil(userId), obterAgenda(userId), verificarAcessoIa(userId, admin !== null)]);
  const atual = perfil?.nivelAtividade ?? null;
  return (
    <div className="space-y-10">
      <Link href="/ajustes" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <h1 className="text-3xl font-black">Nível de atividade</h1>
      <p className="text-lg text-suave">Ele define quantas calorias o seu corpo gasta por dia (estimativa). Conte como é a sua semana e a IA sugere o nível; você confirma ou escolhe outro.</p>
      {sp.salvo === "1" ? <p role="status" className="rounded-2xl border-2 border-ok p-4 font-semibold text-ok"><span aria-hidden="true">✓ </span>Nível salvo.</p> : null}

      <Diagnostico treinosPorSemana={agenda.size > 0 ? agenda.size : null} iaDisponivel={acesso.ok || Boolean(acesso.precisaAceite)} />

      <section aria-labelledby="lista" className="space-y-4">
        <h2 id="lista" className="text-2xl font-bold">Ou escolha na lista</h2>
        <ul className="space-y-3">
          {NIVEIS_ATIVIDADE.map((n) => (
            <li key={n} className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 ${atual === n ? "border-marca" : "border-linha"}`}>
              <div>
                <p className="font-semibold">{ROTULOS_ATIVIDADE[n]}</p>
                <p className="text-sm text-suave">Fator {String(FATORES_ATIVIDADE[n]).replace(".", ",")}{atual === n ? " · atual" : ""}</p>
              </div>
              <form action={confirmarAtividade}>
                <input type="hidden" name="nivel" value={n} />
                <button type="submit" className="min-h-12 rounded-full border-2 border-borda px-5 font-semibold">{atual === n ? "Atual" : "Usar"}</button>
              </form>
            </li>
          ))}
        </ul>
        <p className="text-xs text-suave">Na dúvida, escolha o menor: as pessoas costumam superestimar a atividade. O app ajusta o gasto com o tempo, usando o seu peso e o que você come.</p>
      </section>
    </div>
  );
}
