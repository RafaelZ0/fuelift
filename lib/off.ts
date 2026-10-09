import "server-only";

import { extrairProdutoOff, type ProdutoExtraido } from "./barras";

// Consulta ao Open Food Facts (API v2). Dados sob licença ODbL: a interface atribui a fonte.
// O app se identifica com User-Agent (o projeto pede isso); o contato é o endereço público do app.
const BASE = "https://world.openfoodfacts.org/api/v2/product/";
const CAMPOS = "code,product_name,product_name_pt,brands,quantity,serving_quantity,nutriments";
const TEMPO_LIMITE_MS = 8_000;
const TAMANHO_MAXIMO = 300_000;

export class ErroOff extends Error {
  constructor() {
    super("falha ao consultar o Open Food Facts"); // sem detalhes: nada de código nem de texto da resposta
    this.name = "ErroOff";
  }
}

/** `codigo` já deve ter passado por normalizarCodigo (só dígitos). */
export async function consultarOff(codigo: string): Promise<ProdutoExtraido> {
  const agente = process.env.OFF_USER_AGENT || "Kalyft/0.1 (+https://kalyft.vercel.app)";
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${codigo}?fields=${CAMPOS}`, {
      headers: { "User-Agent": agente, Accept: "application/json" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      redirect: "error", // a API não redireciona; qualquer redirecionamento é recusado
      cache: "no-store",
    });
  } catch {
    throw new ErroOff();
  }
  if (resposta.status === 404) return { status: "nao_encontrado" };
  if (!resposta.ok) throw new ErroOff();
  const texto = await resposta.text();
  if (texto.length > TAMANHO_MAXIMO) throw new ErroOff();
  try {
    return extrairProdutoOff(JSON.parse(texto));
  } catch {
    throw new ErroOff();
  }
}
