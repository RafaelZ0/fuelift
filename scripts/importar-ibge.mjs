// Importa as medidas referidas do IBGE (POF 2008-2009) para medidas_ibge. Idempotente.
//
// Uso: npm run ibge:importar -- --alvo dev|test|producao [--confirmar] [--simular]
// Usa a URL do papel DONO (DATABASE_URL_MIGRACOES): o papel do app não pode gravar nessa tabela.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { normalizarBusca } from "../lib/busca.ts";

const ARQUIVO = "dados/ibge/tabela-medidas-referidas-pof2008.csv";
const SHA256 = "5221d3b8a999637605db6a26d1d055534f43a40d42a66a85acb54ce25083fbad";
const IGNORAR = new Set(["GRAMA", "QUILO"]);

export const FONTE = {
  fonte: "ibge",
  edicao: "pof-2008-2009",
  titulo: "Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil (POF 2008-2009)",
  url: "https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabela_de_Medidas_Referidas_para_os_Alimentos_Consumidos_no_Brasil/",
  termos: "Dados públicos do IBGE; os arquivos não trazem licença explícita. Usar citando a fonte.",
  citacao:
    "Fonte: IBGE, Diretoria de Pesquisas, Coordenação de Trabalho e Rendimento, Pesquisa de Orçamentos Familiares 2008-2009.",
};

/**
 * Extrai as medidas canônicas: medida relatada = medida padrão, sem grama/quilo,
 * com "Alimento - medida" na descrição da referência. Remove repetições.
 */
export function extrairMedidas(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.split(";"));
  const dados = linhas.filter((r) => /^\d{7}$/.test(r[0]));
  const erros = [];
  const vistos = new Set();
  const medidas = [];
  for (const r of dados) {
    if (r[4] !== r[6] || IGNORAR.has(r[5])) continue;
    const ref = (r[10] ?? "").replace(/\s+/g, " ").trim();
    const i = ref.indexOf(" - ");
    if (i < 0) continue;
    const refAlimento = ref.slice(0, i).trim();
    const medida = ref.slice(i + 3).trim();
    const gramas = Number(String(r[8]).replace(",", "."));
    if (!refAlimento || !medida) continue;
    if (!(gramas > 0 && gramas <= 2000)) {
      erros.push(`código ${r[0]} "${ref}": gramas fora da faixa (${r[8]})`);
      continue;
    }
    const chave = `${refAlimento}|${medida}|${gramas}`.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    medidas.push({
      codigo_pof: r[0],
      descricao_pof: r[1].trim().slice(0, 200),
      ref_alimento: refAlimento.slice(0, 200),
      medida: medida.charAt(0).toLowerCase() + medida.slice(1, 80),
      gramas,
      nome_busca: normalizarBusca(refAlimento),
    });
  }
  return { medidas, linhasDados: dados.length, erros };
}

function lerEnv(arquivo) {
  if (!existsSync(arquivo)) throw new Error(`${arquivo} não encontrado.`);
  const linha = readFileSync(arquivo, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL_MIGRACOES="));
  const url = linha?.slice("DATABASE_URL_MIGRACOES=".length).trim();
  if (!url) throw new Error(`DATABASE_URL_MIGRACOES ausente em ${arquivo}.`);
  return url;
}

async function main() {
  const args = process.argv.slice(2);
  const alvo = args[args.indexOf("--alvo") + 1];
  const envs = { dev: ".env.local", test: ".env.test.local", producao: ".env.main.local" };
  if (!envs[alvo]) throw new Error("Informe --alvo dev, test ou producao.");
  if (alvo === "producao" && !args.includes("--confirmar")) throw new Error("Produção exige --confirmar.");

  const buf = readFileSync(ARQUIVO);
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== SHA256) throw new Error(`SHA-256 diferente do arquivo conferido (${hash}).`);
  const { medidas, linhasDados, erros } = extrairMedidas(buf.toString("utf8"));
  if (erros.length) throw new Error(`Validação falhou, nada foi gravado:\n- ${erros.join("\n- ")}`);
  console.log(`Arquivo conferido (SHA-256 ok). ${linhasDados} linhas de dados; ${medidas.length} medidas únicas para importar.`);
  if (args.includes("--simular")) return console.log("Simulação: nada foi gravado.");

  const sql = neon(lerEnv(envs[alvo]));
  await sql.transaction([
    sql`insert into fontes_alimentos (fonte, edicao, titulo, url, termos, citacao, arquivo_sha256)
        values (${FONTE.fonte}, ${FONTE.edicao}, ${FONTE.titulo}, ${FONTE.url}, ${FONTE.termos}, ${FONTE.citacao}, ${hash})
        on conflict (fonte, edicao) do update set titulo = excluded.titulo, url = excluded.url, termos = excluded.termos,
          citacao = excluded.citacao, arquivo_sha256 = excluded.arquivo_sha256, importado_em = now()`,
    sql`insert into medidas_ibge (codigo_pof, descricao_pof, ref_alimento, medida, gramas, nome_busca)
        select r.codigo_pof, r.descricao_pof, r.ref_alimento, r.medida, r.gramas, r.nome_busca
        from jsonb_to_recordset(${JSON.stringify(medidas)}::jsonb) as r(
          codigo_pof text, descricao_pof text, ref_alimento text, medida text, gramas numeric, nome_busca text)
        on conflict (ref_alimento, medida, gramas) do update set codigo_pof = excluded.codigo_pof,
          descricao_pof = excluded.descricao_pof, nome_busca = excluded.nome_busca`,
  ]);
  const [{ total }] = await sql`select count(*)::int as total from medidas_ibge`;
  console.log(`Gravado no branch "${alvo}". Medidas do IBGE no banco: ${total}.`);
}

if (process.argv[1]?.endsWith("importar-ibge.mjs")) {
  main().catch((e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  });
}
