import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, createToken, roleForPassword } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { error, limited, readJson } from "@/lib/http";
import { readGeo } from "@/lib/ip-geo";
import { clientIp } from "@/lib/rate-limit";
import { loginLocked } from "@/lib/second-password";


/** Position approximative déduite de l'IP (en-têtes Vercel, src/lib/ip-geo.ts ; absents en local : valeurs nulles). */
function geo(req: Request) {
  const { city, region, country, latitude, longitude } = readGeo(req.headers);
  return { city, region, country, latitude, longitude };
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
  // Verrouillage persistant (src/lib/second-password.ts) : 10 échecs par IP ou 30 toutes IP en 15 minutes → 429 pendant 15 minutes.
  if (await loginLocked(store, ip)) return error("Trop de tentatives, réessayez dans 15 minutes.", 429);

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
