// Leitor mínimo de XLSX (zip + XML) só com módulos nativos do Node.
// Suficiente para planilhas simples como a da TACO: lê textos compartilhados,
// textos embutidos e números de cada célula. Não avalia fórmulas nem estilos.
import zlib from "node:zlib";

function lerZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fim < 0) throw new Error("Arquivo não é um XLSX (zip) válido.");
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const arquivos = {};
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const tamanho = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28);
    const el = buf.readUInt16LE(p + 30);
    const cl = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString("utf8", p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(local + 26);
    const lel = buf.readUInt16LE(local + 28);
    const dados = buf.subarray(local + 30 + lnl + lel, local + 30 + lnl + lel + tamanho);
    if (metodo !== 0 && metodo !== 8) throw new Error(`Compressão não suportada em ${nome}.`);
    arquivos[nome] = metodo === 8 ? zlib.inflateRawSync(dados) : dados;
    p += 46 + nl + el + cl;
  }
  return arquivos;
}

const entidades = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Retorna as linhas da aba `indice` (1, 2, ...) como { n, celulas: { A: "...", B: "..." } }. */
export function lerAba(buf, indice) {
  const arquivos = lerZip(buf);
  const compartilhados = arquivos["xl/sharedStrings.xml"]
    ? [...arquivos["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        entidades([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
      )
    : [];
  const xml = arquivos[`xl/worksheets/sheet${indice}.xml`];
  if (!xml) throw new Error(`Aba ${indice} não encontrada.`);
  const linhas = [];
  for (const r of xml.toString("utf8").matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const celulas = {};
    for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tipo = (c[2].match(/t="(\w+)"/) || [])[1];
      const v = (c[3] || "").match(/<v>([\s\S]*?)<\/v>/);
      const embutido = (c[3] || "").match(/<t[^>]*>([\s\S]*?)<\/t>/);
      celulas[c[1]] =
        tipo === "s" ? compartilhados[Number(v?.[1])] ?? "" : tipo === "inlineStr" ? entidades(embutido?.[1] ?? "") : v ? entidades(v[1]) : "";
    }
    linhas.push({ n: Number(r[1]), celulas });
  }
  return linhas;
}
