// Interface do provedor de IA (o resto do app só conhece isto, não o Gemini).
export const TIPOS_ARQUIVO = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type TipoArquivo = (typeof TIPOS_ARQUIVO)[number];

export type ArquivoIa = { mimeType: TipoArquivo; dados: Uint8Array };

export type PedidoIa = { sistema: string; texto: string; arquivos: ArquivoIa[] };

export type MotivoErroIa = "indisponivel" | "limite_provedor" | "bloqueada" | "formato" | "config";

export class ErroIa extends Error {
  constructor(public readonly motivo: MotivoErroIa) {
    super(motivo); // a mensagem é só o motivo: nunca carrega texto do usuário nem da IA
    this.name = "ErroIa";
  }
}

export interface ProvedorIa {
  /** Devolve o JSON da resposta (ainda NÃO confiável: passa por sanitizarRespostaDaIa). */
  gerar(pedido: PedidoIa): Promise<unknown>;
}
