import { summarizeClicks } from "@/lib/clicks";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { json } from "@/lib/http";

/**
 * Admin (lecture) : partages par réseau, arrivées par lien partagé, clics « S'abonner », et qui
 * partage : chaque votant (pseudo s'il participe au tirage) avec les personnes que ses liens ont ramenées.
 */
export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;
  const store = getStore();
  // shortcut: toutes les réponses sont relues pour relier cookie de vote, vote validé et pseudo ; à remplacer par une requête ciblée sur les cookies des clics si la table dépasse quelques dizaines de milliers de lignes.
  const [clicks, responses, participants] = await Promise.all([store.listClicks(), store.listResponses(), store.listParticipants()]);
  const pseudo = new Map(participants.map((p) => [p.id, p.pseudo]));
  const people = new Map<string, { pseudo: string | null; voted: boolean }>();
  for (const r of responses) {
    if (!r.voter_id) continue;
    const p = people.get(r.voter_id) ?? { pseudo: null, voted: false };
    if (r.completed_at) p.voted = true;
    if (!p.pseudo && r.participant_id) p.pseudo = pseudo.get(r.participant_id) ?? null;
    people.set(r.voter_id, p);
  }
  return json(
    summarizeClicks(clicks, (voter) => people.get(voter) ?? { pseudo: null, voted: false }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
