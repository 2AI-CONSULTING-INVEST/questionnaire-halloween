import { NextResponse } from "next/server";
import { clickSchema } from "@/lib/clicks";
import { serverNow } from "@/lib/clock";
import { parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { limited, readJson, zodError } from "@/lib/http";
import { BOT_UA_RE } from "@/lib/visits";
import { ensureVoter, readVoter, setVoterCookie } from "@/lib/voter";

/**
 * Public : clic de partage, arrivée par un lien partagé ou clic « S'abonner » (src/lib/clicks.ts).
 * Robots déclarés ignorés, 30 clics par minute et par IP au plus. À l'arrivée par un lien partagé,
 * le cookie de vote est posé tout de suite : le vote qui suivra sera relié au partage. Toujours 204.
 */
export async function POST(req: Request) {
  if (limited(req, "click", 30)) return new Response(null, { status: 204 });
  const userAgent = req.headers.get("user-agent");
  if (!userAgent || BOT_UA_RE.test(userAgent)) return new Response(null, { status: 204 });

  const body = await readJson(req);
  if (body instanceof Response) return body;
  const parsed = clickSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const c = parsed.data;

  const voter = c.kind === "arrival" ? ensureVoter(req) : { id: readVoter(req), isNew: false };
  await getStore().recordClick({
    day: parisDay(serverNow(req)),
    kind: c.kind,
    target: c.target,
    ref: c.kind === "follow" ? null : c.ref,
    voter_id: voter.id,
  });
  const res = new NextResponse(null, { status: 204 });
  return voter.isNew && voter.id ? setVoterCookie(res, voter.id) : res;
}
