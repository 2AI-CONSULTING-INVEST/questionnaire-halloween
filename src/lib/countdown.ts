/**
 * Durée d'attente avant la réouverture du vote, en clair : « 5 h 12 min », puis « 3 min 40 s » dans la
 * dernière heure, « 40 s » dans la dernière minute. Fonction pure (testée).
 */
export function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

/** Version lisible par les lecteurs d'écran, sans secondes au-delà de la dernière minute. */
export function speakWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} heure${h > 1 ? "s" : ""} et ${m} minute${m > 1 ? "s" : ""}`;
  if (m > 0) return `${m} minute${m > 1 ? "s" : ""}`;
  return "moins d'une minute";
}
