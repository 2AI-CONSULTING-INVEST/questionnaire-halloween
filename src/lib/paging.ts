/**
 * Pagination par curseur (keyset) des listes du backoffice : 100 lignes par page, curseur
 * `valeur|id` (valeur de la colonne de tri de la dernière ligne, puis son id) encodé en base64url.
 * Fonctions pures, partagées par les deux stores et testées unitairement.
 */

export const PAGE_SIZE = 100;
export const PAGE_MAX = 200;

export type Cursor = { value: string; id: string };
export type Page<T> = { rows: T[]; nextCursor: string | null; total: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.value}|${c.id}`, "utf8").toString("base64url");
}

/** null si le curseur est mal formé (valeur vide ou trop longue, id non uuid). */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw || raw.length > 600 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const at = text.lastIndexOf("|");
  if (at <= 0) return null;
  const value = text.slice(0, at);
  const id = text.slice(at + 1).toLowerCase();
  // Pas de guillemet, d'antislash ni de caractère de contrôle : la valeur est injectée dans un filtre PostgREST entre guillemets.
  return value.length <= 300 && !/["\\\p{Cc}]/u.test(value) && UUID_RE.test(id) ? { value, id } : null;
}

/** Ordre (valeur, id) par comparaison simple de chaînes (même ordre que la base pour les dates ISO et les uuid). */
export function compareKeys(a: Cursor, b: Cursor): number {
  if (a.value !== b.value) return a.value < b.value ? -1 : 1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

/** Vrai si la ligne vient strictement après le curseur, dans le sens `dir`. */
export function afterCursor(row: Cursor, cursor: Cursor, dir: "asc" | "desc"): boolean {
  const cmp = compareKeys(row, cursor);
  return dir === "asc" ? cmp > 0 : cmp < 0;
}

/**
 * Recherche d'une réponse : une adresse IP complète (v4 ou v6, validée par `isIp`) → égalité sur `ip_address`
 * (colonne inet : une IP incomplète ferait échouer la requête) ; un début d'empreinte en hexa → préfixe de
 * `device_hash` ; tout le reste → aucune requête, page vide.
 */
export function searchKind(q: string, isIp: (s: string) => boolean): "ip" | "device" | "none" {
  if (isIp(q)) return "ip";
  return /^[0-9a-f]{3,64}$/i.test(q) ? "device" : "none";
}

/** Terme de recherche `ilike` : `%`, `_` et `\` échappés (motif littéral) ; caractères réservés de PostgREST (`,()"'*`) retirés. */
export function escapeLike(term: string): string {
  return term.replace(/[,()"'*]/g, "").replace(/[\\%_]/g, (c) => `\\${c}`);
}
