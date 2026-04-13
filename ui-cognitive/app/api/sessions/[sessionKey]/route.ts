import { auth } from "@/auth";
import { safeParseJson } from "@/lib/api-utils";
import { deleteSession, getSessionOwnership, renameSession } from "@/lib/sessions";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionKey: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await safeParseJson<{ title?: unknown }>(request);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  if (typeof body.title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { sessionKey } = await context.params;

  try {
    await renameSession(sessionKey, body.title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/sessions] rename failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionKey: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionKey } = await context.params;
  const ownership = await getSessionOwnership(sessionKey);

  if (!ownership) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const callerId = session.user.id;
  const callerRole = (session.user as { role?: string }).role;
  const isCreator = ownership.createdBy.id === callerId;
  const isAdmin = callerRole === "admin";

  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: "No tienes permiso para borrar esta sesión" }, { status: 403 });
  }

  try {
    await deleteSession(sessionKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/sessions] delete failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
