import { ImageResponse } from "next/og";

/**
 * Ícone do app desenhado em código (sem arquivo binário no repositório):
 * um "F" em blocos sobre fundo escuro. `margem` reduz o desenho para a
 * área segura dos ícones "maskable".
 */
export function desenharIcone(tamanho: number, margem = 0.22): ImageResponse {
  const u = (tamanho * (1 - margem * 2)) / 5;
  const x0 = tamanho * margem;
  const y0 = tamanho * margem;
  const bloco = (x: number, y: number, w: number, h: number, cor: string) => (
    <div
      style={{
        position: "absolute",
        left: x0 + x * u,
        top: y0 + y * u,
        width: w * u,
        height: h * u,
        background: cor,
        borderRadius: u * 0.12,
      }}
    />
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0b0b0a" }}>
        {bloco(0.5, 0, 1.2, 5, "#d2f53c")}
        {bloco(0.5, 0, 4, 1.2, "#d2f53c")}
        {bloco(0.5, 2.1, 2.8, 1.1, "#d2f53c")}
        {bloco(3.7, 3.9, 1.1, 1.1, "#f4f4ef")}
      </div>
    ),
    { width: tamanho, height: tamanho },
  );
}
