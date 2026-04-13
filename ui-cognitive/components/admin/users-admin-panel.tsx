"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
};

export const UsersAdminPanel = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No se pudieron cargar usuarios");
      }

      const payload = (await response.json()) as { users?: UserRow[] };
      setUsers(payload.users ?? []);
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        setError(fetchError.message);
      } else {
        setError("Error inesperado");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const validateForm = () => {
    const nextFieldErrors: FieldErrors = {};

    if (!name.trim()) {
      nextFieldErrors.name = "El nombre es obligatorio.";
    }

    if (!email.trim()) {
      nextFieldErrors.email = "El email es obligatorio.";
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextFieldErrors.email = "Ingresa un email valido.";
    }

    if (password.length < 8) {
      nextFieldErrors.password = "La password debe tener al menos 8 caracteres.";
    }

    setFieldErrors(nextFieldErrors);
    return Object.keys(nextFieldErrors).length === 0;
  };

  const onCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo crear el usuario");
      }

      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
      setFieldErrors({});
      await fetchUsers();
    } catch (createError) {
      if (createError instanceof Error) {
        setError(createError.message);
      } else {
        setError("Error inesperado");
      }
    } finally {
      setSaving(false);
    }
  };

  const onToggleUser = async (user: UserRow) => {
    setError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "No se pudo actualizar el usuario");
        return;
      }

      await fetchUsers();
    } catch {
      setError("No se pudo actualizar el usuario");
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <section className="neu-raised p-4">
        <h1 className="text-xl font-semibold">Admin · Usuarios</h1>
        <p className="mt-1 text-sm text-muted">Alta y activacion/desactivacion de usuarios locales.</p>
      </section>

      <section className="grid min-h-0 gap-4 lg:grid-cols-[360px_1fr]">
        <form className="neu-raised grid content-start gap-3 p-4" onSubmit={onCreateUser}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Nuevo usuario</h2>

          <label className="grid gap-1">
            <span className="text-sm">Nombre</span>
            <input
              required
              value={name}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((previous) => ({ ...previous, name: undefined }));
              }}
              className="neu-inset border border-transparent px-3 py-2 outline-none"
            />
            {fieldErrors.name ? (
              <span id="name-error" className="text-xs text-[var(--error)]">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Email</span>
            <input
              required
              type="email"
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((previous) => ({ ...previous, email: undefined }));
              }}
              className="neu-inset border border-transparent px-3 py-2 outline-none"
            />
            {fieldErrors.email ? (
              <span id="email-error" className="text-xs text-[var(--error)]">
                {fieldErrors.email}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Password</span>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((previous) => ({ ...previous, password: undefined }));
              }}
              className="neu-inset border border-transparent px-3 py-2 outline-none"
            />
            {fieldErrors.password ? (
              <span id="password-error" className="text-xs text-[var(--error)]">
                {fieldErrors.password}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Rol</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "user")}
              className="neu-inset border border-transparent px-3 py-2 outline-none"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="styled-button mt-2"
          >
            {saving ? "Guardando..." : "Crear usuario"}
          </button>

          {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
        </form>

        <div className="neu-raised min-h-0 overflow-hidden p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Usuarios actuales</h2>

          <div className="min-h-0 space-y-2 overflow-y-auto">
            {loading ? (
              <>
                <div className="neu-inset h-16 animate-pulse rounded-xl" />
                <div className="neu-inset h-16 animate-pulse rounded-xl" />
                <div className="neu-inset h-16 animate-pulse rounded-xl" />
              </>
            ) : null}

            {!loading && users.length === 0 ? <p className="text-sm text-muted">No hay usuarios.</p> : null}

            {!loading
              ? users.map((user) => (
                  <article key={user.id} className="neu-inset rounded-xl px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="text-xs text-muted">{user.email}</p>
                        <p className="mt-1 text-xs text-muted">rol: {user.role}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleUser(user)}
                        aria-label={`${user.active ? "Desactivar" : "Activar"} usuario ${user.name}`}
                        className="styled-button styled-button-compact"
                      >
                        {user.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </article>
                ))
              : null}
          </div>
        </div>
      </section>
    </div>
  );
};
