"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="neu-raised w-full max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold">Algo salio mal</h1>
        <p className="text-sm text-muted">Ocurrio un error inesperado al cargar la aplicacion.</p>
        <p className="rounded-lg bg-[color:var(--error)]/10 px-3 py-2 text-xs text-[var(--error)]">
          {error.message || "Error desconocido"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="styled-button"
        >
          Reintentar
        </button>
      </section>
    </main>
  );
}
