/**
 * Jour de vote : un seul vote par appareil et par jour, le jour étant compté en heure de Paris
 * (Europe/Paris, changements d'heure compris). Helpers purs, partagés par le serveur et le navigateur.
 */
export const VOTE_TIME_ZONE = "Europe/Paris";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: VOTE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: VOTE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** « 2026-10-25 » : le jour civil à Paris pour cet instant. */
export function parisDay(at: Date | string | number = Date.now()): string {
  return dayFormat.format(new Date(at));
}

const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: VOTE_TIME_ZONE, hourCycle: "h23", hour: "2-digit" });

/** Heure de la journée à Paris (0–23) pour cet instant. */
export function parisHour(at: Date | string | number = Date.now()): number {
  return Number(hourFormat.format(new Date(at)));
}

/** Décalage (ms) entre l'heure de Paris et UTC à cet instant (+3600000 en hiver, +7200000 en été). */
function parisOffset(at: number) {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFormat.formatToParts(new Date(at))) if (type !== "literal") p[type] = Number(value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000;
}

/** Instant (UTC) du minuit parisien qui ouvre le jour « YYYY-MM-DD ». */
export function parisMidnight(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  // Deux passes : le décalage peut changer entre l'estimation et le vrai minuit (nuit du changement d'heure).
  let t = naive - parisOffset(naive);
  t = naive - parisOffset(t);
  return new Date(t);
}

/** Prochain minuit à Paris (strictement après `at`) : moment où le vote se réinitialise. */
export function nextParisMidnight(at: Date | string | number = Date.now()): Date {
  const [y, m, d] = parisDay(at).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return parisMidnight(next.toISOString().slice(0, 10));
}

/** Vrai si « day » est strictement avant le jour courant à Paris. */
export function isPastDay(day: string, at: Date | string | number = Date.now()): boolean {
  return day < parisDay(at);
}
