import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { BASE_PATH } from "./base-path";

export type Role = "admin" | "viewer";
export const ADMIN_COOKIE = "chamas_admin";
const TTL_SECONDS = 60 * 60 * 12;

/** Secret d'une variable d'environnement : 32 caractères minimum, erreur explicite en production, valeur de développement sinon. */
function envSecret(name: "ADMIN_SESSION_SECRET" | "RISK_SECRET") {
  const s = process.env[name];
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    if (s || name === "ADMIN_SESSION_SECRET") throw new Error(`${name} doit faire au moins 32 caractères.`);
    return null; // RISK_SECRET absent : repli sur le secret de session
  }
  return "dev-only-secret-change-me-dev-only-secret";
}

export const sessionSecret = () => envSecret("ADMIN_SESSION_SECRET")!;
/** Secret des empreintes d'appareil : `RISK_SECRET` (conseillé, distinct), sinon le secret de session. */
export const riskSecret = () => envSecret("RISK_SECRET") ?? sessionSecret();

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const PASSWORD_MIN = 16;

/** Vérifie un mot de passe et renvoie le rôle associé. En production, les mots de passe font au moins 16 caractères (erreur explicite sinon, comme `secret()`). */
export function roleForPassword(password: string): Role | null {
  const admin = process.env.ADMIN_PASSWORD;
  const viewer = process.env.ADMIN_READONLY_PASSWORD;
  if (process.env.NODE_ENV === "production" && ((admin && admin.length < PASSWORD_MIN) || (viewer && viewer.length < PASSWORD_MIN))) {
    throw new Error(`ADMIN_PASSWORD et ADMIN_READONLY_PASSWORD doivent faire au moins ${PASSWORD_MIN} caractères.`);
  }
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
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now() / 1000) return null;
  return role === "admin" || role === "viewer" ? { role, sid } : null;
}

export async function currentSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: BASE_PATH, // l'application vit sous /halloween : le jeton n'est pas envoyé au reste du domaine
  maxAge: TTL_SECONDS,
};
