import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/**
 * Admin (écriture, journalisé) : purge des données expirées (mêmes règles que supabase/purge.sql) :
 * IP, navigateur et attributs d'appareil des réponses de plus de 30 jours effacés ; visites de plus de
 * 90 jours, sessions du backoffice (et leurs actions) de plus de 180 jours, échecs de connexion de plus
 * de 30 jours supprimés.
 */
export async function POST(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  await getStore().purge();
  return json({ ok: true });
}
