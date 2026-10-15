/**
 * Horloge de test : permet de simuler « le lendemain » (vote quotidien) sans attendre minuit.
 * Activée uniquement si NEXT_PUBLIC_HW_TEST_CLOCK=1 au moment du build (jamais en production) :
 *  - serveur : cookie `hw_test_now` lu sur chaque requête ;
 *  - navigateur : clé localStorage `hw-test-now`.
 * Valeur : un instant ISO (horloge figée) ou un décalage en millisecondes « +86400000 » (horloge
 * qui avance, décalée). Sans cette variable, tout le code ci-dessous se réduit à Date.now().
 */
export const TEST_CLOCK = process.env.NEXT_PUBLIC_HW_TEST_CLOCK === "1";
export const TEST_CLOCK_COOKIE = "hw_test_now";
export const TEST_CLOCK_STORAGE_KEY = "hw-test-now";

const parse = (v: string | null | undefined) => {
  if (!v) return null;
  if (/^[+-]\d+$/.test(v)) return Date.now() + Number(v);
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/** Instant courant côté serveur (ms), éventuellement simulé par le cookie de test. */
export function serverNow(req: Request): number {
  if (!TEST_CLOCK) return Date.now();
  const raw = req.headers.get("cookie") ?? "";
  const part = raw.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${TEST_CLOCK_COOKIE}=`));
  return parse(part ? decodeURIComponent(part.slice(TEST_CLOCK_COOKIE.length + 1)) : null) ?? Date.now();
}

/** Instant courant côté navigateur (ms), éventuellement simulé par localStorage. */
export function clientNow(): number {
  if (!TEST_CLOCK || typeof window === "undefined") return Date.now();
  try {
    return parse(localStorage.getItem(TEST_CLOCK_STORAGE_KEY)) ?? Date.now();
  } catch {
    return Date.now();
  }
}
