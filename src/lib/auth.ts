import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type Role = "admin" | "viewer";
export const ADMIN_COOKIE = "chamas_admin";
const TTL_SECONDS = 60 * 60 * 12;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET doit faire au moins 32 caractères.");
  }
  return "dev-only-secret-change-me-dev-only-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Vérifie un mot de passe et renvoie le rôle associé. */
export function roleForPassword(password: string): Role | null {
  const admin = process.env.ADMIN_PASSWORD;
  const viewer = process.env.ADMIN_READONLY_PASSWORD;
  if (admin && safeEqual(password, admin)) return "admin";
  if (viewer && safeEqual(password, viewer)) return "viewer";
  return null;
}

export type Session = { role: Role; sid: string };

/** Jeton signé : rôle, expiration, identifiant de session (ligne du journal `admin_sessions`). */
export function createToken(role: Role, sid: string = randomUUID()) {
  const payload = `${role}.${Math.floor(Date.now() / 1000) + TTL_SECONDS}.${sid}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [role, exp, sid, sig] = token.split(".");
  if (!role || !exp || !sid || !sig) return null;
  if (!safeEqual(sig, sign(`${role}.${exp}.${sid}`))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return role === "admin" || role === "viewer" ? { role, sid } : null;
}

export async function currentSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function currentRole(): Promise<Role | null> {
  return (await currentSession())?.role ?? null;
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: TTL_SECONDS,
};
