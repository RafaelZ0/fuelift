// Refaz a imagem no navegador (JPEG, lado maior até 1600 px). Ao redesenhar no canvas, os metadados
// (EXIF, como localização e câmera) não são copiados. Roda só no cliente.
const LADO_MAXIMO = 1600;

export async function gerarImagemSemMetadados(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new Error("Use apenas imagens (JPEG, PNG, WebP) ou PDF.");
  const bitmap = await createImageBitmap(arquivo); // respeita a orientação da foto no iPhone
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui preparar a imagem.");
  ctx.fillStyle = "#ffffff"; // PNG com fundo transparente vira branco no JPEG
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("Não consegui preparar a imagem.");
  return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
