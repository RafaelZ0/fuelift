import { urlFoto } from "@/lib/fotos";

/** Duas fotos do exercício (início e fim). Sem foto, não mostra nada. */
export function FotoExercicio({ fotoId, nome }: { fotoId: string | null; nome: string }) {
  const a = urlFoto(fotoId, 0);
  const b = urlFoto(fotoId, 1);
  if (!a || !b) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[a, b].map((src, i) => (
        // Imagem externa de domínio público (Free Exercise DB), liberada na CSP só para esse endereço.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${nome}, ${i === 0 ? "posição inicial" : "posição final"}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full rounded-xl bg-superficie object-cover"
        />
      ))}
    </div>
  );
}
