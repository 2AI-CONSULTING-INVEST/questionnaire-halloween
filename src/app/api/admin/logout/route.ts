import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";

/** Déconnexion : la session est révoquée en base (le jeton ne sera plus accepté) et le cookie effacé. */
export async function POST() {
  const session = await currentSession();
  if (session) {
    try {
      const store = getStore();
      await store.logAdminAction({ session_id: session.sid, method: "POST", path: "/api/admin/logout", action: "Déconnexion", details: null });
      await store.revokeAdminSession(session.sid);
    } catch (e) {
      console.error("Journal du backoffice indisponible :", e);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
