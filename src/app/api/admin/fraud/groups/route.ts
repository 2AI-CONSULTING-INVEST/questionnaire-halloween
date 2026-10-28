import { currentSession } from "@/lib/auth";
import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { attemptView, previewGraph } from "@/lib/fraud-server";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/** Admin (lecture) : groupes du moteur pour un jour (`day`, aujourd'hui par défaut), avec leurs tentatives et leurs liens. */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const viewerOnly = (await currentSession())?.role !== "admin";
  const store = getStore();
  const raw = new URL(req.url).searchParams.get("day");
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parisDay(serverNow(req));
  const [run, active, deleted] = await Promise.all([previewGraph(store, day), store.listParticipants(), store.listParticipants(true)]);
  const participants = new Map([...active, ...deleted].map((p) => [p.id, p]));
  const rows = new Map(run.attempts.map((r) => [r.id, r]));
  return json(
    {
      day,
      groups: run.groups.map((g) => ({
        id: g.id,
        status: g.status,
        conditions: g.conditions,
        links: [...new Set(g.links.map((l) => l.kind))],
        exclude: g.exclude,
        kept: g.kept,
        ipCount: new Set(g.members.map((id) => rows.get(id)!.ip_net ?? rows.get(id)!.ip_address)).size,
        members: g.members.map((id) => attemptView(rows.get(id)!, participants, viewerOnly)),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
