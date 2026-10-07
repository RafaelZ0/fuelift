// Importa a TACO (4ª edição) para alimentos_base. Idempotente: rodar de novo atualiza, não duplica.
//
// Uso:
//   npm run taco:importar -- --alvo dev            (usa .env.local)
//   npm run taco:importar -- --alvo test           (usa .env.test.local)
//   npm run taco:importar -- --alvo producao --confirmar   (usa .env.main.local)
//   acrescente --simular para validar e mostrar o resumo sem gravar.
//
// Usa a URL do papel DONO (DATABASE_URL_MIGRACOES): o papel do app não pode gravar nessa tabela.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { normalizarBusca } from "../lib/busca.ts";
import { lerAba } from "./lib/xlsx.mjs";

const ARQUIVO = "dados/taco/Taco-4a-Edicao.xlsx";
const SHA256 = "a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14";
const COMPLEMENTOS = "dados/taco/complementos-usda.json";
const TOTAL_ESPERADO = 597;

export const FONTE = {
  fonte: "taco",
  edicao: "4a-2011",
  titulo: "Tabela Brasileira de Composição de Alimentos – TACO, 4ª edição revisada e ampliada",
  url: "https://nepa.unicamp.br/publicacoes/",
  termos: "É permitida a reprodução parcial ou total desta obra, desde que citada a fonte.",
  citacao:
    "NEPA/UNICAMP. Tabela brasileira de composição de alimentos – TACO. 4. ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011.",
};

// Colunas da aba 1 usadas pelo app (valores por 100 g).
const COLUNAS = { kcal: "D", proteina_g: "F", gordura_g: "G", carbo_g: "I", fibra_g: "J", sodio_mg: "R" };
const FAIXAS = { kcal: 900, proteina_g: 100, gordura_g: 100, carbo_g: 100, fibra_g: 100, sodio_mg: 40000 };

/**
 * Converte uma célula da TACO. Padrão FAO/INFOODS:
 * Tr (traço) e NA (não aplicável) = 0; * (em reavaliação) e vazio (não analisado) = desconhecido;
 * negativo (artefato do carboidrato por diferença) = 0. Guarda a marcação original.
 */
export function converterCelula(bruto) {
  const v = String(bruto ?? "").trim();
  if (v === "Tr") return { valor: 0, marca: "Tr" };
  if (v === "NA") return { valor: 0, marca: "NA" };
  if (v === "*") return { valor: null, marca: "*" };
  if (v === "") return { valor: null, marca: "vazio" };
  if (!/^-?\d+(\.\d+)?(E-?\d+)?$/i.test(v)) throw new Error(`valor inesperado "${v}"`);
  const n = Number(v);
  if (n < 0) return { valor: 0, marca: "negativo" };
  return { valor: Math.round((n + Number.EPSILON) * 100) / 100, marca: null };
}

export function extrairAlimentos(buf) {
  const linhas = lerAba(buf, 1);
  const alimentos = [];
  const erros = [];
  let grupo = null;
  for (const { n, celulas } of linhas) {
    const a = String(celulas.A ?? "").trim();
    const b = String(celulas.B ?? "").replace(/\s+/g, " ").trim();
    if (/^\d+$/.test(a)) {
      const item = { codigo: a, nome: b, grupo, marcacoes: {} };
      try {
        if (b.length < 1 || b.length > 200) throw new Error("nome vazio ou longo demais");
        for (const [campo, col] of Object.entries(COLUNAS)) {
          const { valor, marca } = converterCelula(celulas[col]);
          if (valor !== null && valor > FAIXAS[campo]) throw new Error(`${campo} fora da faixa (${valor})`);
          item[campo] = valor;
          if (marca) item.marcacoes[campo] = { marca };
        }
      } catch (e) {
        erros.push(`linha ${n} (código ${a}): ${e.message}`);
      }
      alimentos.push(item);
    } else if (a && !b && a !== "Número do" && a !== "Alimento" && a !== "Legenda" && n > 3) {
      if (a.startsWith("†") || a === "*") continue;
      grupo = a;
    }
    if (a === "Legenda") break;
  }
  const codigos = new Set(alimentos.map((x) => x.codigo));
  if (codigos.size !== alimentos.length) erros.push("códigos repetidos");
  if (alimentos.length !== TOTAL_ESPERADO) erros.push(`esperava ${TOTAL_ESPERADO} alimentos, encontrei ${alimentos.length}`);
  return { alimentos, erros };
}

/** Aplica valores complementares aprovados (USDA) aos campos desconhecidos, registrando a fonte. */
function aplicarComplementos(alimentos) {
  if (!existsSync(COMPLEMENTOS)) return 0;
  const dados = JSON.parse(readFileSync(COMPLEMENTOS, "utf8"));
  let n = 0;
  for (const c of dados.itens) {
    const alvo = alimentos.find((x) => x.codigo === String(c.codigo_taco));
    if (!alvo) throw new Error(`complemento para código inexistente ${c.codigo_taco}`);
    for (const [campo, valor] of Object.entries(c.valores)) {
      if (alvo[campo] !== null) continue; // só preenche o que a TACO não tem
      if (!(valor >= 0 && valor <= FAIXAS[campo])) throw new Error(`complemento fora da faixa: ${c.codigo_taco} ${campo}`);
      alvo[campo] = valor;
      alvo.marcacoes[campo] = { ...(alvo.marcacoes[campo] ?? {}), fonte: "usda", ref: `FDC ${c.fdc_id}` };
      n++;
    }
  }
  return n;
}

function lerEnv(arquivo) {
  if (!existsSync(arquivo)) throw new Error(`${arquivo} não encontrado.`);
  const linha = readFileSync(arquivo, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL_MIGRACOES="));
  const url = linha?.slice("DATABASE_URL_MIGRACOES=".length).trim();
  if (!url) throw new Error(`DATABASE_URL_MIGRACOES ausente em ${arquivo}.`);
  return url;
}

const fmt = (v, casas) => (v === null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));

async function main() {
  const args = process.argv.slice(2);
  const alvo = args[args.indexOf("--alvo") + 1];
  const simular = args.includes("--simular");
  const envs = { dev: ".env.local", test: ".env.test.local", producao: ".env.main.local" };
  if (!envs[alvo]) throw new Error("Informe --alvo dev, test ou producao.");
  if (alvo === "producao" && !args.includes("--confirmar")) throw new Error("Produção exige --confirmar.");

  const buf = readFileSync(ARQUIVO);
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== SHA256) throw new Error(`SHA-256 diferente do arquivo oficial conferido (${hash}).`);

  const { alimentos, erros } = extrairAlimentos(buf);
  if (erros.length) throw new Error(`Validação falhou, nada foi gravado:\n- ${erros.join("\n- ")}`);
  const complementados = aplicarComplementos(alimentos);

  const semKcal = alimentos.filter((x) => x.kcal === null);
  console.log(`Arquivo conferido (SHA-256 ok). ${alimentos.length} alimentos válidos.`);
  console.log(`Valores complementares (USDA) aplicados: ${complementados}.`);
  console.log(`Sem calorias (não poderão ser adicionados): ${semKcal.map((x) => `${x.codigo} ${x.nome}`).join("; ") || "nenhum"}`);
  if (simular) return console.log("Simulação: nada foi gravado.");

  const sql = neon(lerEnv(envs[alvo]));
  const linhas = alimentos.map((x) => ({
    codigo_fonte: x.codigo,
    nome: x.nome,
    nome_busca: normalizarBusca(x.nome),
    grupo: x.grupo,
    kcal: x.kcal,
    proteina_g: x.proteina_g,
    carbo_g: x.carbo_g,
    gordura_g: x.gordura_g,
    fibra_g: x.fibra_g,
    sodio_mg: x.sodio_mg,
    marcacoes: x.marcacoes,
  }));

  // Uma transação: grava a fonte e todos os alimentos, ou nada.
  await sql.transaction([
    sql`insert into fontes_alimentos (fonte, edicao, titulo, url, termos, citacao, arquivo_sha256)
        values (${FONTE.fonte}, ${FONTE.edicao}, ${FONTE.titulo}, ${FONTE.url}, ${FONTE.termos}, ${FONTE.citacao}, ${hash})
        on conflict (fonte, edicao) do update set titulo = excluded.titulo, url = excluded.url, termos = excluded.termos,
          citacao = excluded.citacao, arquivo_sha256 = excluded.arquivo_sha256, importado_em = now()`,
    sql`insert into alimentos_base (fonte, edicao, codigo_fonte, nome, nome_busca, grupo, kcal, proteina_g, carbo_g, gordura_g, fibra_g, sodio_mg, marcacoes)
        select ${FONTE.fonte}, ${FONTE.edicao}, r.codigo_fonte, r.nome, r.nome_busca, r.grupo, r.kcal, r.proteina_g, r.carbo_g, r.gordura_g, r.fibra_g, r.sodio_mg, coalesce(r.marcacoes, '{}'::jsonb)
        from jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb) as r(
          codigo_fonte text, nome text, nome_busca text, grupo text, kcal numeric, proteina_g numeric, carbo_g numeric,
          gordura_g numeric, fibra_g numeric, sodio_mg numeric, marcacoes jsonb)
        on conflict (fonte, codigo_fonte) do update set edicao = excluded.edicao, nome = excluded.nome, nome_busca = excluded.nome_busca,
          grupo = excluded.grupo, kcal = excluded.kcal, proteina_g = excluded.proteina_g, carbo_g = excluded.carbo_g,
          gordura_g = excluded.gordura_g, fibra_g = excluded.fibra_g, sodio_mg = excluded.sodio_mg, marcacoes = excluded.marcacoes,
          atualizado_em = now()`,
  ]);

  const [{ total }] = await sql`select count(*)::int as total from alimentos_base where fonte = 'taco'`;
  console.log(`\nGravado no branch "${alvo}". Alimentos da TACO no banco: ${total}.`);
  const amostra = await sql`select codigo_fonte, nome, kcal, proteina_g, carbo_g, gordura_g, fibra_g, sodio_mg
                            from alimentos_base where fonte = 'taco' order by random() limit 5`;
  console.log("\n5 alimentos sorteados (arredondados como no PDF: kcal e sódio sem casas, gramas com 1 casa):");
  for (const a of amostra) {
    console.log(
      `  ${a.codigo_fonte.padStart(3)} ${a.nome}\n      kcal ${fmt(a.kcal, 0)} | proteína ${fmt(a.proteina_g, 1)} g | carboidrato ${fmt(a.carbo_g, 1)} g | ` +
        `lipídeos ${fmt(a.gordura_g, 1)} g | fibra ${fmt(a.fibra_g, 1)} g | sódio ${fmt(a.sodio_mg, 0)} mg`,
    );
  }
}

if (process.argv[1]?.endsWith("importar-taco.mjs")) {
  main().catch((e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  });
}
