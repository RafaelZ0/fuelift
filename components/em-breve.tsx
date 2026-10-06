export function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <h1 className="text-4xl font-black tracking-tight">{titulo}</h1>
      <p className="mt-4 max-w-xs text-lg text-suave">{texto}</p>
    </>
  );
}
