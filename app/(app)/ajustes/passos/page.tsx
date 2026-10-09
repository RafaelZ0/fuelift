import { headers } from "next/headers";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarTokens, passosDoPeriodo } from "@/lib/dal/passos";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { revogarTokenPassos } from "./actions";
import { NovoToken } from "./novo-token";

export const metadata = { title: "Passos · Kalyft" };

export default async function PaginaPassos() {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const [tokens, recentes] = await Promise.all([listarTokens(userId), passosDoPeriodo(userId, somarDias(hoje, -6), hoje)]);
  const h = await headers();
  const host = h.get("host") ?? "kalyft.vercel.app";
  const url = `https://${host}/api/passos`;
  const ativos = tokens.filter((t) => !t.revogadoEm);

  return (
    <div className="space-y-12">
      <Link href="/ajustes" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <h1 className="text-3xl font-black">Passos do iPhone</h1>
      <p className="text-lg text-suave">
        Um app da web não lê o app Saúde. Por isso o iPhone envia os seus passos todos os dias, por uma automação do app Atalhos. Os passos ajudam a interpretar o seu gasto; <strong>não</strong> são somados como calorias.
      </p>

      <section aria-labelledby="chave" className="space-y-4">
        <h2 id="chave" className="text-2xl font-bold">1. Crie uma chave</h2>
        <NovoToken />
      </section>

      <section aria-labelledby="atalho" className="space-y-4">
        <h2 id="atalho" className="text-2xl font-bold">2. Monte a automação no Atalhos</h2>
        <p className="rounded-2xl border-2 border-aviso p-4 text-sm font-medium text-aviso">
          <span aria-hidden="true">! </span>Este passo a passo ainda não foi conferido num aparelho: os nomes dos botões do Atalhos mudam entre versões do iOS. Se algo for diferente, me avise.
        </p>
        <ol className="list-decimal space-y-3 pl-6 text-lg">
          <li>Abra o app <strong>Atalhos</strong> → aba <strong>Automação</strong> → <strong>+</strong> → <strong>Horário do dia</strong>, por exemplo 22:00, <strong>Diariamente</strong>, e <strong>Executar imediatamente</strong>.</li>
          <li>Ação <strong>Encontrar Amostras de Saúde</strong>: tipo <strong>Passos</strong>, data de início <strong>é hoje</strong>.</li>
          <li>Ação <strong>Calcular Estatísticas</strong>: <strong>Soma</strong> das amostras encontradas.</li>
          <li>
            Ação <strong>Obter Conteúdo do URL</strong> com o endereço abaixo, método <strong>POST</strong>, cabeçalho <code className="rounded bg-superficie px-1">Authorization</code> com o valor <code className="rounded bg-superficie px-1">Bearer</code> (espaço) e a sua chave, e corpo <strong>JSON</strong> com o campo <code className="rounded bg-superficie px-1">passos</code> igual ao resultado da soma.
          </li>
        </ol>
        <p className="break-all rounded-xl bg-superficie p-3 font-mono text-sm">POST {url}</p>
        <p className="text-sm text-suave">Corpo: <code>{`{"passos": 8234}`}</code>. Opcionalmente <code>data</code> (AAAA-MM-DD, até 7 dias atrás). O último envio do dia vale.</p>
      </section>

      <section aria-labelledby="chaves" className="space-y-3">
        <h2 id="chaves" className="text-2xl font-bold">Suas chaves</h2>
        {tokens.length === 0 ? <p className="text-suave">Nenhuma chave ainda.</p> : null}
        <ul>
          {tokens.map((t) => (
            <li key={t.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-linha py-2">
              <div>
                <p className="font-semibold">{t.nome}{t.revogadoEm ? <span className="ml-2 text-sm text-suave">(revogada)</span> : null}</p>
                <p className="text-sm text-suave">
                  criada em {formatarDataBr(t.criadoEm.toISOString().slice(0, 10))}
                  {t.ultimoUso ? ` · último envio ${formatarDataBr(t.ultimoUso.toISOString().slice(0, 10))}` : " · nunca usada"}
                </p>
              </div>
              {!t.revogadoEm ? (
                <form action={revogarTokenPassos}>
                  <input type="hidden" name="tokenId" value={t.id} />
                  <button type="submit" className="min-h-12 rounded-full border-2 border-erro px-4 font-semibold text-erro">Revogar</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {ativos.length > 0 ? <p className="text-sm text-suave">Revogar uma chave a invalida na hora; o iPhone que a usa deixa de enviar.</p> : null}
      </section>

      <section aria-labelledby="ultimos" className="space-y-3">
        <h2 id="ultimos" className="text-2xl font-bold">Últimos 7 dias</h2>
        {recentes.length === 0 ? (
          <p className="text-suave">Ainda não chegaram passos.</p>
        ) : (
          <ul>
            {[...recentes].reverse().map((p) => (
              <li key={p.data} className="flex min-h-12 items-center justify-between border-b border-linha">
                <span>{formatarDataBr(p.data)}</span>
                <span className="font-semibold">{p.passos.toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
