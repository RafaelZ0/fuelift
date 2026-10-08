// Importa o catálogo Free Exercise DB (domínio público) para catalogo_exercicios. Idempotente.
//
// Uso: npm run exercicios:importar -- --alvo dev|test|producao [--confirmar] [--simular]
// Usa a URL do papel DONO (DATABASE_URL_MIGRACOES): o papel do app só lê essa tabela.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { normalizarBusca } from "../lib/busca.ts";

const ARQUIVO = "dados/exercicios/free-exercise-db.json";
const SHA256 = "5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf";
const TOTAL_ESPERADO = 876;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,120}$/;

/** Valida e converte o JSON do catálogo. Qualquer linha fora do padrão aborta a importação. */
export function extrairExercicios(texto) {
  const dados = JSON.parse(texto);
  const erros = [];
  if (!Array.isArray(dados)) return { exercicios: [], erros: ["o arquivo não é uma lista"] };
  const ids = new Set();
  const exercicios = [];
  for (const [i, e] of dados.entries()) {
    const nome = typeof e?.name === "string" ? e.name.trim() : "";
    if (!ID_VALIDO.test(String(e?.id ?? ""))) erros.push(`item ${i}: id inválido`);
    else if (ids.has(e.id)) erros.push(`item ${i}: id repetido (${e.id})`);
    else ids.add(e.id);
    if (nome.length < 1 || nome.length > 120) erros.push(`item ${i}: nome inválido`);
    const musculos = Array.isArray(e?.primaryMuscles) ? e.primaryMuscles.filter((m) => typeof m === "string").slice(0, 6) : [];
    const imagens = Array.isArray(e?.images) ? e.images : [];
    // As fotos só são usadas se seguirem o padrão <id>/0.jpg e <id>/1.jpg.
    const temFotos = imagens.length === 2 && imagens[0] === `${e?.id}/0.jpg` && imagens[1] === `${e?.id}/1.jpg`;
    exercicios.push({
      id: e?.id,
      nome_en: nome,
      nome_busca: normalizarBusca(nome),
      equipamento: typeof e?.equipment === "string" && e.equipment ? e.equipment.slice(0, 40) : null,
      categoria: typeof e?.category === "string" && e.category ? e.category.slice(0, 40) : null,
      nivel: typeof e?.level === "string" && e.level ? e.level.slice(0, 20) : null,
      musculos_primarios: musculos,
      tem_fotos: temFotos,
    });
  }
  if (exercicios.length !== TOTAL_ESPERADO) erros.push(`esperava ${TOTAL_ESPERADO} exercícios, encontrei ${exercicios.length}`);
  return { exercicios, erros };
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
  const { exercicios, erros } = extrairExercicios(buf.toString("utf8"));
  if (erros.length) throw new Error(`Validação falhou, nada foi gravado:\n- ${erros.slice(0, 10).join("\n- ")}`);
  console.log(`Arquivo conferido (SHA-256 ok). ${exercicios.length} exercícios válidos (${exercicios.filter((e) => e.tem_fotos).length} com as 2 fotos).`);
  if (args.includes("--simular")) return console.log("Simulação: nada foi gravado.");

  const sql = neon(lerEnv(envs[alvo]));
  await sql.transaction([
    sql`insert into catalogo_exercicios (id, nome_en, nome_busca, equipamento, categoria, nivel, musculos_primarios, tem_fotos)
        select r.id, r.nome_en, r.nome_busca, r.equipamento, r.categoria, r.nivel, coalesce(r.musculos_primarios, '[]'::jsonb), r.tem_fotos
        from jsonb_to_recordset(${JSON.stringify(exercicios)}::jsonb) as r(
          id text, nome_en text, nome_busca text, equipamento text, categoria text, nivel text, musculos_primarios jsonb, tem_fotos boolean)
        on conflict (id) do update set nome_en = excluded.nome_en, nome_busca = excluded.nome_busca,
          equipamento = excluded.equipamento, categoria = excluded.categoria, nivel = excluded.nivel,
          musculos_primarios = excluded.musculos_primarios, tem_fotos = excluded.tem_fotos`,
  ]);
  const [{ total }] = await sql`select count(*)::int as total from catalogo_exercicios`;
  console.log(`Gravado no branch "${alvo}". Exercícios no catálogo: ${total}.`);
}

if (process.argv[1]?.endsWith("importar-exercicios.mjs")) {
  main().catch((e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
  });
}
