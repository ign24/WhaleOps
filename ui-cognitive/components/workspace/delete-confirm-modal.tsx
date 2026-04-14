"use client";

import { useState } from "react";

interface DeleteConfirmModalProps {
  token: string;
  targetPath: string;
  sizeMb: number;
  onSuccess: (result: { status: string; size_freed_mb: number }) => void;
  onCancel: () => void;
  onExpired: () => void;
}

export function DeleteConfirmModal({
  token,
  targetPath,
  sizeMb,
  onSuccess,
  onCancel,
  onExpired,
}: DeleteConfirmModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/workspace/delete/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });

      const data = await res.json();

      if (res.status === 410 || data.error === "token_expired") {
        onExpired();
        return;
      }

      if (!res.ok) {
        setPin("");
        setError("PIN incorrecto. Intentá de nuevo.");
        return;
      }

      onSuccess(data);
    } catch {
      setPin("");
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Confirmar eliminación
      </h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Esta acción es irreversible.
      </p>

      <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{targetPath}</span>
        <span className="ml-2 text-zinc-400">({sizeMb} MB)</span>
      </div>

      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        PIN de confirmación
      </label>
      <input
        data-testid="pin-input"
        type="password"
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="mb-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        placeholder="Ingresá el PIN"
        disabled={loading}
      />

      {error && (
        <p data-testid="pin-error" className="mb-3 text-xs text-red-500">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          data-testid="cancel-btn"
          onClick={onCancel}
          disabled={loading}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <button
          data-testid="confirm-btn"
          onClick={handleConfirm}
          disabled={loading || pin.length === 0}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </div>
  );
}
