import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import bcrypt from "bcryptjs";

const usersFilePath = path.join(process.cwd(), "data", "users.json");

const email = (process.env.E2E_EMAIL ?? "e2e-admin@cgn.local").trim().toLowerCase();
const password = process.env.E2E_PASSWORD ?? "e2e-password-123";
const name = (process.env.E2E_NAME ?? "E2E Admin").trim();

if (password.length < 8) {
  throw new Error("E2E_PASSWORD must be at least 8 characters");
}

const loadUsers = async () => {
  try {
    const content = await readFile(usersFilePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const users = await loadUsers();
const passwordHash = await bcrypt.hash(password, 12);

const existingIndex = users.findIndex((user) => {
  if (!user || typeof user !== "object") {
    return false;
  }

  const row = user;
  return typeof row.email === "string" && row.email.trim().toLowerCase() === email;
});

const baseUser = {
  id: existingIndex >= 0 && typeof users[existingIndex].id === "string" ? users[existingIndex].id : `e2e-${Date.now()}`,
  name,
  email,
  passwordHash,
  role: "admin",
  active: true,
  createdAt:
    existingIndex >= 0 && typeof users[existingIndex].createdAt === "string"
      ? users[existingIndex].createdAt
      : new Date().toISOString(),
};

if (existingIndex >= 0) {
  users[existingIndex] = {
    ...users[existingIndex],
    ...baseUser,
  };
} else {
  users.push(baseUser);
}

await writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
