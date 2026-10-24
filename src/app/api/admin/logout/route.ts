import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";

export async function POST() {
  const session = await currentSession();
  if (session) {
    try {
      await getStore().logAdminAction({ session_id: session.sid, method: "POST", path: "/api/admin/logout", action: "Déconnexion", details: null });
    } catch (e) {
      console.error("Journal du backoffice indisponible :", e);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
