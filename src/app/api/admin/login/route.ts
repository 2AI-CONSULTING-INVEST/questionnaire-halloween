import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, createToken, roleForPassword } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { error, limited, readJson } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";

/** Verrouillage persistant (table `login_failures`) : 10 échecs par IP ou 30 toutes IP en 15 minutes → 429 pendant 15 minutes. */
const LOCK_WINDOW_MS = 15 * 60_000;
const LOCK_PER_IP = 10;
const LOCK_GLOBAL = 30;

/** En-têtes de géolocalisation par IP posés par Vercel (absents en local : valeurs nulles). */
function geo(req: Request) {
  const text = (name: string) => {
    const v = req.headers.get(name);
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 120);
    } catch {
      return v.slice(0, 120); // encodage invalide : valeur brute (la connexion et son journal ne doivent pas en dépendre)
    }
  };
  const num = (name: string) => {
    const v = Number(req.headers.get(name));
    return req.headers.get(name) && Number.isFinite(v) ? v : null;
  };
  return { city: text("x-vercel-ip-city"), region: text("x-vercel-ip-country-region"), country: text("x-vercel-ip-country"), latitude: num("x-vercel-ip-latitude"), longitude: num("x-vercel-ip-longitude") };
}

export async function POST(req: Request) {
  const blocked = limited(req, "admin-login", 10);
  if (blocked) return blocked;

  if (!process.env.ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD n'est pas configuré sur le serveur");
    return error("Service indisponible", 503);
  }

  const raw = await readJson(req);
  if (raw instanceof Response) return raw;
  const body = raw as { password?: unknown } | undefined;
  const password = typeof body?.password === "string" ? body.password : "";

  const store = getStore();
  const ip = clientIp(req);
  const since = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const [byIp, all] = await Promise.all([store.countLoginFailures(since, ip), store.countLoginFailures(since)]);
  if (byIp >= LOCK_PER_IP || all >= LOCK_GLOBAL) return error("Trop de tentatives, réessayez dans 15 minutes.", 429);

  const role = roleForPassword(password);
  if (!role) {
    await store.recordLoginFailure(ip);
    return error("Mot de passe incorrect", 401);
  }

  // Journal : la session (IP, appareil, position approximative) puis l'action « Connexion ». Sans
  // session en base, le jeton serait refusé (requireRole) : on refuse la connexion plutôt.
  let sid: string;
  try {
    const session = await store.createAdminSession({ role, ip, user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null, ...geo(req) });
    sid = session.id;
    await store.logAdminAction({ session_id: sid, method: "POST", path: "/api/admin/login", action: "Connexion", details: null });
  } catch (e) {
    console.error("Journal du backoffice indisponible :", e);
    return error("Service indisponible", 503);
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(ADMIN_COOKIE, createToken(role, sid), cookieOptions);
  return res;
}
