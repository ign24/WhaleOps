import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { safeParseJson } from "@/lib/api-utils";
import { setUserActive } from "@/lib/users";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (session.user.role !== "admin") {
    return forbidden();
  }

  const { userId } = await context.params;
  const parsed = await safeParseJson<{ active?: boolean }>(request);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be boolean" }, { status: 400 });
  }

  const updated = await setUserActive(userId, body.active);
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: updated });
}
