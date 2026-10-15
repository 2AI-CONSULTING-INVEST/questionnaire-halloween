import { serverNow } from "@/lib/clock";
import { nextParisMidnight, parisDay } from "@/lib/day";
import { getStore } from "@/lib/db";
import { json, limited } from "@/lib/http";
import { readVoter } from "@/lib/voter";

/** Public, lecture seule : cet appareil (cookie hw_voter) a-t-il déjà voté aujourd'hui, et quand le vote rouvre-t-il ? */
export async function GET(req: Request) {
  const blocked = limited(req, "vote-status", 60);
  if (blocked) return blocked;
  const now = serverNow(req);
  const voter = readVoter(req);
  const votedToday = voter ? await getStore().hasVotedToday(voter, parisDay(now)) : false;
  return json(
    { votedToday, today: parisDay(now), nextResetAt: nextParisMidnight(now).toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
