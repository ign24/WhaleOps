import { auth } from "@/auth";
import { getSessionMessages } from "@/lib/sessions";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionKey: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionKey } = await context.params;

  try {
    const messages = await getSessionMessages(sessionKey);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[api/sessions/history] load failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
