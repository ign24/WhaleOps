import { promises as fs } from "fs";
import path from "path";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

export type PublicUser = Omit<AppUser, "passwordHash">;

const usersFilePath =
  process.env.USERS_FILE_PATH ?? path.join(process.cwd(), "data", "users.json");

const readUsers = async (): Promise<AppUser[]> => {
  const fileContent = await fs.readFile(usersFilePath, "utf8");
  return JSON.parse(fileContent) as AppUser[];
};

const writeUsers = async (users: AppUser[]) => {
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
};

const toPublicUser = (user: AppUser): PublicUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
};

export const findActiveUserByEmail = async (
  email: string,
): Promise<AppUser | undefined> => {
  const users = await readUsers();
  const normalizedEmail = email.trim().toLowerCase();

  return users.find(
    (user) => user.active && user.email.trim().toLowerCase() === normalizedEmail,
  );
};

export const listPublicUsers = async (): Promise<PublicUser[]> => {
  const users = await readUsers();
  return users.map(toPublicUser);
};

export const createUser = async (input: {
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
}): Promise<PublicUser> => {
  const users = await readUsers();
  const normalizedEmail = input.email.trim().toLowerCase();
  const duplicated = users.some(
    (user) => user.email.trim().toLowerCase() === normalizedEmail,
  );

  if (duplicated) {
    throw new Error("email-already-exists");
  }

  const newUser: AppUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    role: input.role,
    active: true,
    createdAt: new Date().toISOString(),
  };

  await writeUsers([...users, newUser]);
  return toPublicUser(newUser);
};

export const setUserActive = async (
  userId: string,
  active: boolean,
): Promise<PublicUser | null> => {
  const users = await readUsers();
  const targetIndex = users.findIndex((user) => user.id === userId);

  if (targetIndex < 0) {
    return null;
  }

  users[targetIndex] = {
    ...users[targetIndex],
    active,
  };

  await writeUsers(users);
  return toPublicUser(users[targetIndex]);
};
