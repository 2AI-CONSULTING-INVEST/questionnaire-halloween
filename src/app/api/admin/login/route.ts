import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, createToken, roleForPassword } from "@/lib/auth";
import { error, limited, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const blocked = limited(req, "admin-login", 10);
  if (blocked) return blocked;

  if (!process.env.ADMIN_PASSWORD) return error("ADMIN_PASSWORD n'est pas configuré sur le serveur", 500);

  const body = (await readJson(req)) as { password?: unknown } | undefined;
  const password = typeof body?.password === "string" ? body.password : "";
  const role = roleForPassword(password);
  if (!role) return error("Mot de passe incorrect", 401);

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(ADMIN_COOKIE, createToken(role), cookieOptions);
  return res;
}
