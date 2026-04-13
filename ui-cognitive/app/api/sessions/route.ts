import { auth } from "@/auth";
import { createSession, listSessions } from "@/lib/sessions";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[api/sessions] list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionKey = randomUUID().slice(0, 8);
  const createdBy = {
    id: session.user.id ?? "system",
    name: session.user.name ?? "Usuario",
  };

  try {
    const created = await createSession(sessionKey, createdBy);
    return NextResponse.json(created);
  } catch (error) {
    console.error("[api/sessions] create failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
