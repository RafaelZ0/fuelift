export default function LayoutEntrar({ children }: LayoutProps<"/entrar">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <p className="text-5xl font-black tracking-tight [font-stretch:115%]">
        Fuel<span className="text-destaque">Lift</span>
      </p>
      <div className="mt-12 flex-1">{children}</div>
    </main>
  );
}
