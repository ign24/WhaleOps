export type SessionRow = {
  sessionKey: string;
  title: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
};

export const normalizeSessions = (payload: unknown): SessionRow[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as {
    result?: { sessions?: Array<Record<string, unknown>> };
    sessions?: Array<Record<string, unknown>>;
  };

  const rows = source.result?.sessions ?? source.sessions ?? [];

  return rows.map((row) => {
    const sessionKey = String(row.sessionKey ?? row.sessionId ?? "main");
    const title = String(row.label ?? row.title ?? sessionKey);
    const updatedAt = String(row.updatedAt ?? row.lastActiveAt ?? "");

    const rawCreatedBy = row.createdBy;
    const createdBy =
      rawCreatedBy &&
      typeof rawCreatedBy === "object" &&
      typeof (rawCreatedBy as Record<string, unknown>).id === "string" &&
      typeof (rawCreatedBy as Record<string, unknown>).name === "string"
        ? (rawCreatedBy as { id: string; name: string })
        : { id: "system", name: "Sistema" };

    return { sessionKey, title, updatedAt, createdBy };
  });
};
