import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { safeParseJson } from "@/lib/api-utils";
import { createUser, listPublicUsers } from "@/lib/users";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (session.user.role !== "admin") {
    return forbidden();
  }

  const users = await listPublicUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (session.user.role !== "admin") {
    return forbidden();
  }

  const parsed = await safeParseJson<{
    name?: string;
    email?: string;
    password?: string;
    role?: "admin" | "user";
  }>(request);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const name = body.name?.trim();
  const email = body.email?.trim();
  const password = body.password ?? "";
  const role = body.role === "admin" ? "admin" : "user";

  if (!name || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Invalid payload. name, email and password(8+) are required." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      name,
      email,
      passwordHash,
      role,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "email-already-exists") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
