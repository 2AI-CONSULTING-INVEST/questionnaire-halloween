import { currentSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { attemptView, loadReview } from "@/lib/fraud-server";
import type { PersonDetail } from "@/lib/fraud-review";
import { requireRole } from "@/lib/guard";
import { error, json } from "@/lib/http";

/** Admin (lecture) : dépli d'une ligne « Votes frauduleux » (vote compté en tête, puis toutes les autres tentatives, dans l'ordre). */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const data = await loadReview(getStore());
  const person = data.persons.find((p) => p.key === key);
  if (!person) return error("Introuvable", 404);
  const view = (id: string) => attemptView(data.rows.get(id)!, data.participants, viewerOnly);
  const body: PersonDetail = {
    key,
    counted: person.counted ? view(person.counted) : null,
    attempts: person.attempts.filter((id) => id !== person.first && id !== person.counted).map(view),
  };
  return json(body, { headers: { "Cache-Control": "no-store" } });
}
