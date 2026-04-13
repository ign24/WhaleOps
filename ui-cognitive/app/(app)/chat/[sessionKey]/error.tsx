"use client";

type ChatErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ChatError({ error, reset }: ChatErrorProps) {
  return (
    <div className="neu-raised mx-auto w-full max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Error al cargar la conversación</h1>
      <p className="text-sm text-muted">La sesión no pudo renderizarse correctamente.</p>
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
