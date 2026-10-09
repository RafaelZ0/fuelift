import { exigirUsuario } from "@/lib/auth/sessao";
import { listarPendentes } from "@/lib/dal/acessos";
import { historicoMetas, metaVigente } from "@/lib/dal/metas";
import { obterPerfil } from "@/lib/dal/perfil";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import type { Meta } from "@/lib/db/schema";
import Link from "next/link";
import { sair } from "../../acoes";
import { decidirCadastro } from "./actions";
import { PainelMetas, PainelPerfil, type MetaTela } from "./paineis";

export const metadata = { title: "Ajustes · Kalyft" };

// Só os campos necessários vão para o navegador (sem user_id nem ids).
function paraTela(m: Meta): MetaTela {
  return {
    vigenteDesde: m.vigenteDesde,
    kcal: m.kcal,
    proteinaG: m.proteinaG,
    carboG: m.carboG,
    gorduraG: m.gorduraG,
    aguaMl: m.aguaMl,
    pesoMetaKg: m.pesoMetaKg,
    dataMeta: m.dataMeta,
    observacao: m.observacao,
  };
}

export default async function PaginaAjustes() {
  const { userId, admin } = await exigirUsuario();
  const [perfil, meta, historico, pendentes] = await Promise.all([
    obterPerfil(userId),
    metaVigente(userId, hojeSaoPaulo()),
    historicoMetas(userId),
    admin ? listarPendentes(admin) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-14">
      <h1 className="text-4xl font-black tracking-tight">Ajustes</h1>

      <PainelPerfil
        perfil={{
          nome: perfil?.nome ?? null,
          dataNascimento: perfil?.dataNascimento ?? null,
          sexo: perfil?.sexo ?? null,
          alturaCm: perfil?.alturaCm ?? null,
          nivelAtividade: perfil?.nivelAtividade ?? null,
          inicioPlano: perfil?.inicioPlano ?? null,
        }}
      />

      <PainelMetas meta={meta ? paraTela(meta) : null} historico={historico.map(paraTela)} />

      <section aria-labelledby="atalhos" className="space-y-3">
        <h2 id="atalhos" className="text-2xl font-bold">Gasto, meta e passos</h2>
        {[
          ["/progresso/meta", "Meta e plano", "Gasto estimado, opções de calorias e projeção do peso"],
          ["/ajustes/atividade", "Nível de atividade", "Conte sua rotina e a IA sugere o nível"],
          ["/ajustes/passos", "Passos do iPhone", "Chave e automação do app Atalhos"],
        ].map(([href, titulo, texto]) => (
          <Link key={href} href={href} className="block rounded-2xl border-2 border-linha p-4 active:border-marca">
            <span className="block text-lg font-bold">{titulo}</span>
            <span className="block text-sm text-suave">{texto}</span>
          </Link>
        ))}
      </section>

      {admin ? (
        <section aria-labelledby="cadastros">
          <h2 id="cadastros" className="mb-2 text-2xl font-bold">Cadastros pendentes</h2>
          {pendentes.length === 0 ? (
            <p className="text-suave">Nenhum cadastro aguardando.</p>
          ) : (
            <ul>
              {pendentes.map((p) => (
                <li key={p.userId} className="border-b border-linha py-4">
                  <p className="font-semibold break-all">{p.email}</p>
                  <p className="text-sm text-suave">pedido em {formatarDataBr(p.criadoEm.toISOString().slice(0, 10))}</p>
                  <form action={decidirCadastro} className="mt-3 flex gap-3">
                    <input type="hidden" name="alvo" value={p.userId} />
                    <button name="decisao" value="aprovar" className="min-h-12 flex-1 rounded-full bg-destaque font-bold text-sobre-destaque">
                      Aprovar
                    </button>
                    <button name="decisao" value="recusar" className="min-h-12 flex-1 rounded-full border-2 border-borda font-semibold">
                      Recusar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <form action={sair}>
        <button type="submit" className="min-h-12 w-full rounded-full border-2 border-borda font-semibold text-suave">
          Sair da conta
        </button>
      </form>
    </div>
  );
}
