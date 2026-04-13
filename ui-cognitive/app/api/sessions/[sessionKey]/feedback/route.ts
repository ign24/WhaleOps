import { auth } from "@/auth";
import { safeParseJson } from "@/lib/api-utils";
import { setSessionMessageFeedback } from "@/lib/sessions";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionKey: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await safeParseJson<{
    messageId?: unknown;
    reaction?: unknown;
    comment?: unknown;
  }>(request);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (typeof body.messageId !== "string" || body.messageId.trim().length === 0) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  if (body.reaction !== "up" && body.reaction !== "down") {
    return NextResponse.json({ error: "reaction must be up or down" }, { status: 400 });
  }

  const { sessionKey } = await context.params;

  try {
    const updated = await setSessionMessageFeedback(
      sessionKey,
      body.messageId,
      body.reaction,
      typeof body.comment === "string" ? body.comment : undefined,
    );

    if (!updated) {
      return NextResponse.json({ error: "message not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/sessions/feedback] save failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
