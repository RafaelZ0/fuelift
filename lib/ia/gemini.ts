import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { registrarErro } from "@/lib/log";
import { ESQUEMA_RESPOSTA_IA } from "./rascunho";
import { ErroIa, type PedidoIa, type ProvedorIa } from "./provedor";

const MODELO_PADRAO = "gemini-3.5-flash";
const TEMPO_LIMITE_MS = 60_000;
const ESPERAS_MS = [2_000, 6_000]; // até 3 tentativas em 429/500/503

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function traduzir(e: unknown): ErroIa {
  if (e instanceof ErroIa) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new ErroIa("limite_provedor");
    if (e.status === 400 || e.status === 403) return new ErroIa("config");
    return new ErroIa("indisponivel");
  }
  return new ErroIa("indisponivel");
}

/** Provedor Gemini (chave só no servidor). Os logs nunca incluem texto enviado nem recebido. */
export function criarProvedorGemini(chave: string, modelo = MODELO_PADRAO): ProvedorIa {
  const ai = new GoogleGenAI({ apiKey: chave });
  return {
    async gerar(pedido: PedidoIa): Promise<unknown> {
      const partes = [
        { text: pedido.texto },
        ...pedido.arquivos.map((a) => ({ inlineData: { mimeType: a.mimeType, data: Buffer.from(a.dados).toString("base64") } })),
      ];
      let ultimo: unknown;
      for (let tentativa = 0; tentativa <= ESPERAS_MS.length; tentativa++) {
        try {
          const r = await ai.models.generateContent({
            model: modelo,
            contents: [{ role: "user", parts: partes }],
            config: {
              systemInstruction: pedido.sistema,
              responseMimeType: "application/json",
              responseJsonSchema: pedido.esquema ?? ESQUEMA_RESPOSTA_IA,
              temperature: 0.4,
              maxOutputTokens: 16384,
              abortSignal: AbortSignal.timeout(TEMPO_LIMITE_MS),
            },
          });
          const texto = r.text;
          if (!texto) throw new ErroIa("bloqueada");
          try {
            return JSON.parse(texto);
          } catch {
            throw new ErroIa("formato");
          }
        } catch (e) {
          ultimo = e;
          const t = traduzir(e);
          registrarErro("gemini", e);
          const repetivel = t.motivo === "indisponivel" || t.motivo === "limite_provedor";
          if (!repetivel || tentativa === ESPERAS_MS.length) throw t;
          await dormir(ESPERAS_MS[tentativa]);
        }
      }
      throw traduzir(ultimo);
    },
  };
}
