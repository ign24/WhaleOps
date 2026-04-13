"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <div className="neu-raised mx-auto mt-8 w-full max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">No se pudo cargar esta vista</h1>
      <p className="text-sm text-muted">Podés intentar nuevamente sin perder tu sesión.</p>
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
    </div>
  );
}
