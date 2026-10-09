import { z } from "zod";
import { usuarioDoToken, salvarPassos } from "@/lib/dal/passos";
import { garantirPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limites";
import { registrarErro } from "@/lib/log";
import { hashDoToken, tokenDoCabecalho } from "@/lib/token-api";

// Único Route Handler que recebe dados. Autenticação por token pessoal (Authorization: Bearer ...),
// não por cookie, então não há CSRF. Resposta mínima e sem cache. O token nunca é registrado em log.
export const dynamic = "force-dynamic";

const TAMANHO_MAX = 1024;
const SEM_CACHE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
const json = (corpo: Record<string, unknown>, status: number) => Response.json(corpo, { status, headers: SEM_CACHE });

const numeroInteiro = z.preprocess(
  (v) => (typeof v === "string" && /^\d{1,7}([.,]\d+)?$/.test(v.trim()) ? Number(v.trim().replace(",", ".")) : v),
  z.number().finite().min(0).max(200_000).transform((n) => Math.round(n)),
);

export async function POST(req: Request): Promise<Response> {
  const ip = await ipDaRequisicao();
  if (!(await dentroDoLimite([{ tipo: "passosPorIp", valor: ip }]))) return json({ erro: "limite" }, 429);

  const token = tokenDoCabecalho(req.headers.get("authorization"));
  if (!token) return json({ erro: "nao_autorizado" }, 401);
  const hash = hashDoToken(token);

  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return json({ erro: "use_json" }, 415);
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > TAMANHO_MAX) return json({ erro: "grande_demais" }, 413);
  const texto = await req.text();
  if (texto.length > TAMANHO_MAX) return json({ erro: "grande_demais" }, 413);

  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return json({ erro: "json_invalido" }, 400);
  }

  const hoje = hojeSaoPaulo();
  const r = z
    .object({
      passos: numeroInteiro,
      data: z.iso.date().refine((d) => d <= hoje && d >= somarDias(hoje, -7), "data fora do período").optional(),
    })
    .safeParse(corpo);
  if (!r.success) return json({ erro: "dados_invalidos" }, 400);

  try {
    const dono = await usuarioDoToken(hash);
    if (!dono) return json({ erro: "nao_autorizado" }, 401);
    if (!(await dentroDoLimite([{ tipo: "passosPorToken", valor: dono.tokenId }]))) return json({ erro: "limite" }, 429);
    const data = r.data.data ?? hoje;
    await garantirPerfil(dono.userId);
    await salvarPassos(dono.userId, data, r.data.passos, "atalhos");
    return json({ ok: true, data, passos: r.data.passos }, 200);
  } catch (e) {
    registrarErro("api_passos", e);
    return json({ erro: "falha" }, 500);
  }
}
