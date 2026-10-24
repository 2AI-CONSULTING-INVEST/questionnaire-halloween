import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, createToken, roleForPassword } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { error, limited, readJson } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";

/** En-têtes de géolocalisation par IP posés par Vercel (absents en local : valeurs nulles). */
function geo(req: Request) {
  const text = (name: string) => {
    const v = req.headers.get(name);
    return v ? decodeURIComponent(v).slice(0, 120) : null;
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

  if (!process.env.ADMIN_PASSWORD) return error("ADMIN_PASSWORD n'est pas configuré sur le serveur", 500);

  const body = (await readJson(req)) as { password?: unknown } | undefined;
  const password = typeof body?.password === "string" ? body.password : "";
  const role = roleForPassword(password);
  if (!role) return error("Mot de passe incorrect", 401);

  // Journal : la session (IP, appareil, position approximative) puis l'action « Connexion ».
  let sid: string | undefined;
  try {
    const store = getStore();
    const session = await store.createAdminSession({ role, ip: clientIp(req), user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null, ...geo(req) });
    sid = session.id;
    await store.logAdminAction({ session_id: sid, method: "POST", path: "/api/admin/login", action: "Connexion", details: null });
  } catch (e) {
    console.error("Journal du backoffice indisponible :", e); // la connexion reste possible
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(ADMIN_COOKIE, createToken(role, sid), cookieOptions);
  return res;
}
