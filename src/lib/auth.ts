import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "dg_session";
const MAX_AGE = 60 * 60 * 24 * 14;

export type User = { id: string; email: string; name: string; api_key: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return s ?? "dev-only-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(token: string): string | null {
  const [userId, exp, sig] = token.split(".");
  if (!userId || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return userId;
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const userId = token ? verify(token) : null;
  if (!userId) return null;
  const sql = await db();
  const [user] = await sql<User[]>`select id, email, name, api_key from users where id = ${userId}`;
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function logIn(email: string, password: string): Promise<boolean> {
  const sql = await db();
  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from users where email = ${email.trim().toLowerCase()}`;
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return false;
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${row.id}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function logOut() {
  (await cookies()).delete(COOKIE);
}

export async function userByApiKey(key: string): Promise<User | null> {
  if (!key) return null;
  const sql = await db();
  const [user] = await sql<User[]>`select id, email, name, api_key from users where api_key = ${key}`;
  return user ?? null;
}
