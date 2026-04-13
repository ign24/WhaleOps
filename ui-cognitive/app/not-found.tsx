import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="neu-raised w-full max-w-lg space-y-4 p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">404</p>
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted">La ruta que buscaste no existe o fue movida.</p>
        <Link
          href="/chat/main"
          className="neu-primary neu-button inline-flex cursor-pointer items-center justify-center px-4 py-2 text-sm font-semibold"
        >
          Volver al chat
        </Link>
      </section>
    </main>
  );
}
