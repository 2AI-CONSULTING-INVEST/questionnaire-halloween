import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { applyGraph, previewGraph } from "@/lib/fraud-server";
import { requireRole } from "@/lib/guard";
import { json, readJson, zodError } from "@/lib/http";

const daySchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

const summary = (run: Awaited<ReturnType<typeof previewGraph>>) => ({
  day: run.day,
  confirmed: run.groups.filter((g) => g.status === "confirmed").length,
  suspect: run.groups.filter((g) => g.status === "suspect").length,
  exclude: run.changes.filter((c) => c.exclude).map((c) => c.id),
  restore: run.changes.filter((c) => c.restore).map((c) => c.id),
  ungroup: run.changes.filter((c) => c.groupId === null && !c.restore).length,
  regroup: run.changes.filter((c) => !c.exclude && !c.restore && c.groupId !== null).length,
  withdrawalsRefused: run.withdrawalsRefused,
});

/** Admin (lecture) : aperçu du moteur de groupes pour un jour, sans rien écrire. */
export async function GET(req: Request) {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const raw = new URL(req.url).searchParams.get("day");
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parisDay(serverNow(req));
  return json(summary(await previewGraph(getStore(), day, undefined, parisDay(serverNow(req)))), { headers: { "Cache-Control": "no-store" } });
}

/** Admin (écriture, journalisé) : applique le moteur de groupes à un jour (Recalculer). Les décisions humaines ne bougent pas. */
export async function POST(req: Request) {
  const denied = await requireRole("admin", req);
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = daySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const run = await applyGraph(getStore(), parsed.data.day, { sessionId: (await currentSession())?.sid, reason: "Recalculer (backoffice)", manualToday: parisDay(serverNow(req)) });
  return json(summary(run));
}
